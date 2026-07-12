import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

// First-class escalation objects (see migration 00014). An escalation tracks who
// owns an overdue or blocked item *now* and climbs a tiered ladder
// (1=manager → 2=director → 3=exec) as it is bumped. Every mutation appends an
// escalation_events row and is best-effort audit-logged / notified.

export type EscalationEntity =
  | 'idea'
  | 'evaluation'
  | 'committee_decision'
  | 'change_request'
  | 'sla';

export type EscalationStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled';

export const MAX_ESCALATION_LEVEL = 3;

export type Escalation = {
  id: string;
  entity_type: EscalationEntity;
  entity_id: string;
  opened_at: string;
  opened_by: string | null;
  reason_ar: string | null;
  reason_en: string | null;
  current_level: number;
  current_owner_id: string | null;
  status: EscalationStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_ar: string | null;
  resolution_en: string | null;
};

// Loose generics so both the session client and the service-role admin client
// (schema 'innovation') are assignable.
type Client = SupabaseClient<any, any, any>;

async function resolveClient(client?: Client): Promise<Client | null> {
  if (client) return client;
  return (await createClient()) as Client | null;
}

/**
 * Resolve the user who should own an escalation at a given ladder tier. Prefers
 * an exact `escalation_tier` match; falls back to the highest tier at or below
 * the target, then to any admin. Returns null when no profile qualifies.
 */
async function ownerForTier(supabase: Client, tier: number): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, escalation_tier, role')
    .lte('escalation_tier', tier)
    .order('escalation_tier', { ascending: false });
  const rows = (data as { id: string; escalation_tier: number; role: string }[] | null) ?? [];
  if (!rows.length) {
    const { data: admin } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    return (admin as { id: string } | null)?.id ?? null;
  }
  const exact = rows.find((r) => r.escalation_tier === tier);
  return (exact ?? rows[0]).id;
}

async function notifyOwner(
  supabase: Client,
  ownerId: string | null,
  e: Pick<Escalation, 'entity_type' | 'entity_id' | 'current_level' | 'id'>
): Promise<void> {
  if (!ownerId) return;
  await createNotification(
    ownerId,
    'escalation',
    {
      entityType: e.entity_type,
      entityId: e.entity_id,
      level: e.current_level,
    },
    { client: supabase, link: `/admin/escalations`, email: e.current_level >= 2 }
  );
}

export type OpenEscalationInput = {
  entityType: EscalationEntity;
  entityId: string;
  reason?: string;
  reasonAr?: string;
  actorId?: string | null;
  client?: Client;
};

/**
 * Open an escalation at level 1 and assign it to the resolved tier-1 owner.
 * Best-effort: returns the new escalation id, or null when Supabase is offline.
 */
export async function openEscalation(input: OpenEscalationInput): Promise<string | null> {
  const supabase = await resolveClient(input.client);
  if (!supabase) return null;
  try {
    const ownerId = await ownerForTier(supabase, 1);
    const { data, error } = await supabase
      .from('escalations')
      .insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        opened_by: input.actorId ?? null,
        reason_en: input.reason ?? null,
        reason_ar: input.reasonAr ?? input.reason ?? null,
        current_level: 1,
        current_owner_id: ownerId,
        status: 'open',
      })
      .select('id')
      .maybeSingle();
    if (error || !data) return null;
    const id = (data as { id: string }).id;

    await supabase.from('escalation_events').insert({
      escalation_id: id,
      event_type: 'opened',
      to_level: 1,
      to_owner_id: ownerId,
      actor_id: input.actorId ?? null,
    });

    await logAudit(input.actorId ?? null, 'escalation.opened', 'escalation', id, {
      after: { entityType: input.entityType, entityId: input.entityId, level: 1 },
    });
    await notifyOwner(supabase, ownerId, {
      id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      current_level: 1,
    });
    return id;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[openEscalation] failed:', err);
    return null;
  }
}

/**
 * Open an escalation only when no open/acknowledged one already exists for the
 * same entity. Used by the SLA cron so a repeated breach scan doesn't stack
 * duplicate escalations. Returns the new id, or null when one already exists.
 */
export async function openEscalationIfAbsent(input: OpenEscalationInput): Promise<string | null> {
  const supabase = await resolveClient(input.client);
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('escalations')
      .select('id')
      .eq('entity_type', input.entityType)
      .eq('entity_id', input.entityId)
      .in('status', ['open', 'acknowledged'])
      .maybeSingle();
    if (existing) return null;
  } catch {
    // fall through and attempt the insert
  }
  return openEscalation({ ...input, client: supabase });
}

/**
 * Advance an escalation one rung up the ladder (1→2→3, capped at 3) and reassign
 * to the next-tier owner. No-op when already at the top or not open/acknowledged.
 */
export async function bumpEscalation(
  id: string,
  opts: { actorId?: string | null; client?: Client } = {}
): Promise<boolean> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from('escalations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const e = data as Escalation | null;
    if (!e || (e.status !== 'open' && e.status !== 'acknowledged')) return false;
    if (e.current_level >= MAX_ESCALATION_LEVEL) return false;

    const toLevel = e.current_level + 1;
    const toOwner = await ownerForTier(supabase, toLevel);

    await supabase
      .from('escalations')
      .update({ current_level: toLevel, current_owner_id: toOwner, status: 'open' })
      .eq('id', id);

    await supabase.from('escalation_events').insert({
      escalation_id: id,
      event_type: 'bumped',
      from_level: e.current_level,
      to_level: toLevel,
      from_owner_id: e.current_owner_id,
      to_owner_id: toOwner,
      actor_id: opts.actorId ?? null,
    });

    await logAudit(opts.actorId ?? null, 'escalation.bumped', 'escalation', id, {
      before: { level: e.current_level },
      after: { level: toLevel },
    });
    await notifyOwner(supabase, toOwner, {
      id,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      current_level: toLevel,
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bumpEscalation] failed:', err);
    return false;
  }
}

/** Mark an escalation acknowledged by its current owner. */
export async function acknowledgeEscalation(
  id: string,
  note?: string,
  opts: { actorId?: string | null; client?: Client } = {}
): Promise<boolean> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return false;
  try {
    await supabase.from('escalations').update({ status: 'acknowledged' }).eq('id', id);
    await supabase.from('escalation_events').insert({
      escalation_id: id,
      event_type: 'ack',
      notes_en: note ?? null,
      actor_id: opts.actorId ?? null,
    });
    await logAudit(opts.actorId ?? null, 'escalation.acknowledged', 'escalation', id, {
      after: { note: note ?? null },
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[acknowledgeEscalation] failed:', err);
    return false;
  }
}

/** Resolve an escalation and notify its opener. */
export async function resolveEscalation(
  id: string,
  resolution?: string,
  opts: { actorId?: string | null; client?: Client } = {}
): Promise<boolean> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return false;
  try {
    const { data } = await supabase.from('escalations').select('*').eq('id', id).maybeSingle();
    const e = data as Escalation | null;
    if (!e) return false;

    await supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: opts.actorId ?? null,
        resolution_en: resolution ?? null,
        resolution_ar: resolution ?? null,
      })
      .eq('id', id);

    await supabase.from('escalation_events').insert({
      escalation_id: id,
      event_type: 'resolved',
      notes_en: resolution ?? null,
      actor_id: opts.actorId ?? null,
    });

    await logAudit(opts.actorId ?? null, 'escalation.resolved', 'escalation', id, {
      before: { status: e.status },
      after: { status: 'resolved', resolution: resolution ?? null },
    });

    if (e.opened_by) {
      await createNotification(
        e.opened_by,
        'escalation',
        { entityType: e.entity_type, entityId: e.entity_id, level: e.current_level },
        { client: supabase, link: `/admin/escalations` }
      );
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[resolveEscalation] failed:', err);
    return false;
  }
}

/**
 * Escalations owned by (or opened by) a user, newest first. Feeds the "My
 * escalations" dashboard strips. Only open/acknowledged items are returned.
 */
export async function getEscalationsForUser(
  userId: string,
  opts: { client?: Client } = {}
): Promise<Escalation[]> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('escalations')
      .select('*')
      .or(`current_owner_id.eq.${userId},opened_by.eq.${userId}`)
      .in('status', ['open', 'acknowledged'])
      .order('opened_at', { ascending: false });
    return (data as Escalation[] | null) ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getEscalationsForUser] failed:', err);
    return [];
  }
}

/** All open + acknowledged escalations for the admin queue, newest first. */
export async function getOpenEscalations(opts: { client?: Client } = {}): Promise<Escalation[]> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('escalations')
      .select('*')
      .in('status', ['open', 'acknowledged'])
      .order('current_level', { ascending: false })
      .order('opened_at', { ascending: false });
    return (data as Escalation[] | null) ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getOpenEscalations] failed:', err);
    return [];
  }
}

export type EscalationStatusFilter = 'open' | 'resolved' | 'all';

export type EscalationQuery = {
  status?: EscalationStatusFilter;
  level?: number;
  entityType?: EscalationEntity;
};

// Which raw statuses each UI filter bucket maps to. 'open' groups the active
// ladder (open + acknowledged); 'resolved' groups the closed ones (resolved +
// cancelled); 'all' applies no status filter.
const STATUS_BUCKETS: Record<Exclude<EscalationStatusFilter, 'all'>, EscalationStatus[]> = {
  open: ['open', 'acknowledged'],
  resolved: ['resolved', 'cancelled'],
};

/**
 * Filtered admin escalation query, newest first. Mirrors getOpenEscalations but
 * honours the status/level/entity filter controls on the escalations page.
 */
export async function getEscalations(
  query: EscalationQuery = {},
  opts: { client?: Client } = {}
): Promise<Escalation[]> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return [];
  try {
    let q = supabase.from('escalations').select('*');

    const statusFilter = query.status ?? 'open';
    if (statusFilter !== 'all') q = q.in('status', STATUS_BUCKETS[statusFilter]);
    if (query.level && query.level >= 1 && query.level <= MAX_ESCALATION_LEVEL) {
      q = q.eq('current_level', query.level);
    }
    if (query.entityType) q = q.eq('entity_type', query.entityType);

    const { data } = await q
      .order('current_level', { ascending: false })
      .order('opened_at', { ascending: false });
    return (data as Escalation[] | null) ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getEscalations] failed:', err);
    return [];
  }
}
