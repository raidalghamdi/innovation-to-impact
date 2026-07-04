import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/roles';

// SLA policy engine. Policies (innovation.sla_policies) define a target duration
// for a state transition on an entity; trackers (innovation.sla_tracking) record
// an in-flight window per entity instance. See migration 00009.

export type SlaPolicy = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  entity_type: string;
  from_state: string | null;
  to_state: string | null;
  target_hours: number;
  warn_at_pct: number;
  active: boolean;
};

export type SlaTracker = {
  id: string;
  entity_type: string;
  entity_id: string;
  policy_id: string | null;
  opened_at: string;
  target_at: string;
  breached_at: string | null;
  resolved_at: string | null;
};

export type PendingSla = {
  dueSoon: SlaTracker[];
  breached: SlaTracker[];
};

// Loose generics so both the session client and the service-role admin client
// (schema 'innovation') are assignable.
type Client = SupabaseClient<any, any, any>;

async function resolveClient(client?: Client): Promise<Client | null> {
  if (client) return client;
  return (await createClient()) as Client | null;
}

// Find the active policy governing a given entity transition. from/to are
// matched when the policy specifies them (a null policy column means "any").
async function findPolicy(
  supabase: Client,
  entityType: string,
  fromState: string | null,
  toState: string | null
): Promise<SlaPolicy | null> {
  const { data } = await supabase
    .from('sla_policies')
    .select('*')
    .eq('entity_type', entityType)
    .eq('active', true);
  const policies = (data as SlaPolicy[] | null) ?? [];
  // Prefer an exact transition match (null on either side is a wildcard)...
  const exact = policies.find(
    (p) =>
      (p.from_state === null || fromState === null || p.from_state === fromState) &&
      (p.to_state === null || toState === null || p.to_state === toState)
  );
  if (exact) return exact;
  // ...otherwise, if the entity type has exactly one active policy, bind to it.
  // This keeps callers working even when they don't know the precise state
  // labels, without risking an ambiguous match when several policies exist.
  return policies.length === 1 ? policies[0] : null;
}

/**
 * Open an SLA tracker for an entity entering a monitored transition. No-op when
 * no active policy matches or an unresolved tracker already exists for the same
 * entity+policy (so repeated transitions don't double-count). Best-effort.
 */
export async function openSlaTracker(
  entityType: string,
  entityId: string,
  fromState: string | null,
  toState: string | null,
  opts: { client?: Client } = {}
): Promise<void> {
  try {
    const supabase = await resolveClient(opts.client);
    if (!supabase) return;
    const policy = await findPolicy(supabase, entityType, fromState, toState);
    if (!policy) return;

    const { data: existing } = await supabase
      .from('sla_tracking')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('policy_id', policy.id)
      .is('resolved_at', null)
      .maybeSingle();
    if (existing) return;

    const openedAt = new Date();
    const targetAt = new Date(openedAt.getTime() + policy.target_hours * 3600_000);
    await supabase.from('sla_tracking').insert({
      entity_type: entityType,
      entity_id: entityId,
      policy_id: policy.id,
      opened_at: openedAt.toISOString(),
      target_at: targetAt.toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[openSlaTracker] failed:', err);
  }
}

/**
 * Resolve any open trackers for an entity (the transition completed). Best-effort.
 */
export async function closeSlaTracker(
  entityType: string,
  entityId: string,
  resolved = true,
  opts: { client?: Client } = {}
): Promise<void> {
  if (!resolved) return;
  try {
    const supabase = await resolveClient(opts.client);
    if (!supabase) return;
    await supabase
      .from('sla_tracking')
      .update({ resolved_at: new Date().toISOString() })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('resolved_at', null);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[closeSlaTracker] failed:', err);
  }
}

/**
 * Unresolved SLA items for dashboards, split into already-breached and
 * due-soon (past the warn threshold but not yet breached). Admin and judge see
 * every open tracker; other roles get an empty set (they don't own the queue).
 */
export async function getPendingSla(
  args: { role: Role; userId: string },
  opts: { client?: Client } = {}
): Promise<PendingSla> {
  const empty: PendingSla = { dueSoon: [], breached: [] };
  if (args.role !== 'admin' && args.role !== 'judge') return empty;
  try {
    const supabase = await resolveClient(opts.client);
    if (!supabase) return empty;

    const { data } = await supabase
      .from('sla_tracking')
      .select('*')
      .is('resolved_at', null)
      .order('target_at', { ascending: true });
    const rows = (data as SlaTracker[] | null) ?? [];
    const now = Date.now();
    const breached = rows.filter((r) => new Date(r.target_at).getTime() <= now || r.breached_at);
    const dueSoon = rows.filter(
      (r) => !breached.includes(r) && new Date(r.target_at).getTime() > now
    );
    return { dueSoon, breached };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getPendingSla] failed:', err);
    return empty;
  }
}
