import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fanOut } from '@/lib/notifications';
import { openEscalationIfAbsent, type EscalationEntity } from '@/lib/escalations';
import type { SlaTracker, SlaPolicy } from '@/lib/sla';
import { maybeRunWeeklyBriefing } from '@/lib/weekly-briefing';

// Hourly Vercel Cron (see vercel.json). Marks overdue SLA trackers as breached
// and fans out reminders:
//   • target_at < now, not breached, not resolved  -> mark breached + sla_breached (email)
//   • past warn threshold, not breached, not resolved -> deadline_approaching (in-app)
// Secured with CRON_SECRET: caller must send `authorization: Bearer <CRON_SECRET>`.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Resolve which users to notify about a tracker. Idea/committee entities notify
// the idea's submitter; evaluation entities notify the assigned evaluator.
async function recipientsFor(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  t: SlaTracker
): Promise<string[]> {
  try {
    if (t.entity_type === 'evaluation') {
      const { data } = await supabase
        .from('evaluations')
        .select('evaluator_id')
        .eq('id', t.entity_id)
        .maybeSingle();
      const id = (data as { evaluator_id?: string } | null)?.evaluator_id;
      return id ? [id] : [];
    }
    // idea / committee -> the idea submitter
    const { data } = await supabase
      .from('ideas')
      .select('submitter_id')
      .eq('id', t.entity_id)
      .maybeSingle();
    const id = (data as { submitter_id?: string } | null)?.submitter_id;
    return id ? [id] : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  let breachedCount = 0;
  let warnCount = 0;

  // Open trackers, joined to their policy for the warn threshold.
  const { data, error } = await supabase
    .from('sla_tracking')
    .select('*, policy:policy_id ( target_hours, warn_at_pct )')
    .is('resolved_at', null);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[cron/sla-reminders] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Joined = SlaTracker & { policy: Pick<SlaPolicy, 'target_hours' | 'warn_at_pct'> | null };
  const rows = (data as Joined[] | null) ?? [];
  const now = Date.now();

  for (const t of rows) {
    const targetMs = new Date(t.target_at).getTime();

    // Breached: overdue and not yet flagged.
    if (!t.breached_at && targetMs <= now) {
      await supabase
        .from('sla_tracking')
        .update({ breached_at: nowIso })
        .eq('id', t.id)
        .is('breached_at', null);
      const ids = await recipientsFor(supabase, t);
      await fanOut(
        ids,
        'sla_breached',
        { entityType: t.entity_type, entityId: t.entity_id },
        { email: true, client: supabase }
      );
      // Auto-open a first-class escalation for the breached entity (once — the
      // helper is a no-op when one is already open/acknowledged).
      const escEntity: EscalationEntity =
        t.entity_type === 'evaluation'
          ? 'evaluation'
          : t.entity_type === 'idea'
            ? 'idea'
            : t.entity_type === 'committee'
              ? 'committee_decision'
              : 'sla';
      await openEscalationIfAbsent({
        entityType: escEntity,
        entityId: t.entity_id,
        reason: `SLA breached for ${t.entity_type} (tracker ${t.id})`,
        client: supabase,
      });
      breachedCount += ids.length ? 1 : 0;
      continue;
    }

    // Due soon: past the warn threshold but not yet breached.
    if (!t.breached_at && t.policy) {
      const openedMs = new Date(t.opened_at).getTime();
      const warnMs = openedMs + (targetMs - openedMs) * (t.policy.warn_at_pct / 100);
      if (warnMs <= now) {
        const ids = await recipientsFor(supabase, t);
        await fanOut(
          ids,
          'deadline_approaching',
          { entityType: t.entity_type, entityId: t.entity_id },
          { email: false, client: supabase }
        );
        warnCount += ids.length ? 1 : 0;
      }
    }
  }

  // Hobby-plan safety: Vercel allows only one daily cron job, so the weekly
  // admin briefing (Cross-cutting F3) piggybacks on this daily invocation and
  // only actually runs its logic on Mondays (UTC) — see maybeRunWeeklyBriefing.
  const briefing = await maybeRunWeeklyBriefing();

  return NextResponse.json({
    status: 'ok',
    scanned: rows.length,
    breached: breachedCount,
    warned: warnCount,
    timestamp: nowIso,
    weeklyBriefing: briefing.ran ? { sent: true, recipients: briefing.recipients } : { sent: false },
  });
}
