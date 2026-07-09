import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { createNotification } from '@/lib/notifications';
import { notifyIdeaDecision, type IdeaDecisionEvent } from '@/lib/idea-decision-notify';

type Decision = 'approve' | 'reject' | 'return';

/**
 * POST /api/supervisor/ideas/[id]/decision
 * Body: { decision: 'approve' | 'reject' | 'return', reason?: string, reason_ar?: string }
 *
 * Screening gate — only supervisor (or admin) may transition idea status.
 * Approve  → status='approved'  (idea moves to evaluator queue)
 * Reject   → status='rejected'  (terminal)
 * Return   → status='returned'  (back to innovator for edits)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const isSupervisor = await userHasRole(user.id, 'supervisor');
  if (!isSupervisor && user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    decision?: Decision;
    reason?: string;
    reason_ar?: string;
    editable_sections?: string[] | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { decision, reason = null, reason_ar = null, editable_sections = null } = body;
  if (!decision || !['approve', 'reject', 'return'].includes(decision)) {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 });
  }
  // For 'return', require at least one section so the innovator has a concrete
  // scope of changes to make (the UI enforces this too, but the API must not
  // trust the client).
  const ALLOWED_SECTIONS = new Set([
    'activity_id',
    'strategic_theme_id',
    'challenge',
    'participation_type',
    'team',
    'title',
    'proposed_solution',
    'attachments',
  ]);
  const cleanedSections =
    decision === 'return' && Array.isArray(editable_sections)
      ? editable_sections.filter((s) => ALLOWED_SECTIONS.has(s))
      : null;
  if (decision === 'return' && (!cleanedSections || cleanedSections.length === 0)) {
    return NextResponse.json({ error: 'no_sections_selected' }, { status: 400 });
  }

  const statusMap: Record<Decision, string> = {
    approve: 'approved',
    reject: 'rejected',
    return: 'returned',
  };

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  const update: Record<string, unknown> = {
    status: statusMap[decision],
    updated_at: new Date().toISOString(),
  };
  if (decision === 'approve') {
    update.approved_at = new Date().toISOString();
    // Clear any prior partial-edit gate on approval.
    update.editable_sections = null;
  }
  if (decision !== 'approve') {
    update.rejection_reason = reason;
    update.rejection_reason_ar = reason_ar;
  }
  if (decision === 'return') {
    update.editable_sections = cleanedSections;
  }

  const { error } = await supabase.from('ideas').update(update).eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // ── Notifications (best-effort) ─────────────────────────────────────────
  // 1) Innovator (submitter) is always notified about the supervisor's decision.
  // 2) On approve, evaluators assigned to the idea's track are notified so they
  //    know a new idea has entered their queue.
  try {
    const { data: ideaRow } = await supabase
      .from('ideas')
      .select('id, code, submitter_id, strategic_theme_id')
      .eq('id', id)
      .maybeSingle();
    const ideaCode = (ideaRow as { code?: string } | null)?.code ?? id;
    const themeId = (ideaRow as { strategic_theme_id?: string } | null)?.strategic_theme_id ?? null;

    // Fan the screening decision out to the submitter + team members: in-app
    // (submitter) plus a branded CTA email to each. Exact bilingual copy lives
    // in idea-decision-notify.ts / messages.
    const eventMap: Record<Decision, IdeaDecisionEvent> = {
      approve: 'approved',
      reject: 'rejected',
      return: 'returned',
    };
    await notifyIdeaDecision(id, eventMap[decision]);

    if (decision === 'approve' && themeId) {
      // S4-26 — auto-assign an evaluator on approval, round-robin by workload.
      // Candidate evaluators are those assigned to the idea's track/theme.
      const { data: trackRows } = await supabase
        .from('track_assignments')
        .select('evaluator_id')
        .eq('theme_id', themeId)
        .eq('status', 'active');
      const evalIds = Array.from(
        new Set(
          ((trackRows as { evaluator_id: string }[]) ?? [])
            .map((r) => r.evaluator_id)
            .filter(Boolean)
        )
      );

      if (evalIds.length === 0) {
        // No evaluators for this track — record a warning and skip (non-fatal).
        await supabase
          .from('audit_logs')
          .insert({
            actor_id: user.id,
            action: 'assignment.auto_skip_no_evaluators',
            entity_type: 'idea',
            entity_id: id,
            metadata: { reason: 'no_active_evaluators_for_track', theme_id: themeId },
          })
          .then(() => undefined, () => undefined);
      } else {
        // Skip if this idea already has a live (pending/completed) assignment,
        // so re-approvals don't stack duplicate rows.
        const { data: existing } = await supabase
          .from('assignments')
          .select('id')
          .eq('idea_id', id)
          .in('status', ['pending', 'completed'])
          .limit(1);

        if (!existing || existing.length === 0) {
          // Current workload = count of live assignments per candidate.
          const { data: loadRows } = await supabase
            .from('assignments')
            .select('evaluator_id')
            .in('evaluator_id', evalIds)
            .in('status', ['pending', 'completed']);
          const load = new Map<string, number>(evalIds.map((e) => [e, 0]));
          for (const r of (loadRows as { evaluator_id: string }[]) ?? []) {
            load.set(r.evaluator_id, (load.get(r.evaluator_id) ?? 0) + 1);
          }
          // Least-loaded wins; ties broken by the track-assignment order.
          const chosen = evalIds.reduce((best, e) =>
            (load.get(e) ?? 0) < (load.get(best) ?? 0) ? e : best
          );

          const { error: assignErr } = await supabase.from('assignments').insert({
            idea_id: id,
            evaluator_id: chosen,
            assigned_by: user.id,
            status: 'pending',
          });
          if (!assignErr) {
            await createNotification(
              chosen,
              'evaluation_assigned',
              { ideaId: id, ideaCode },
              { email: true, link: '/evaluation' }
            );
            await supabase
              .from('audit_logs')
              .insert({
                actor_id: user.id,
                action: 'assignment.auto_created',
                entity_type: 'idea',
                entity_id: id,
                metadata: { evaluator_id: chosen, theme_id: themeId, strategy: 'round_robin_least_loaded' },
              })
              .then(() => undefined, () => undefined);
          }
        }
      }
    }
  } catch {
    // Swallow — auto-assignment/notifications must never fail the decision.
  }

  // Best-effort audit
  await supabase
    .from('audit_logs')
    .insert({
      actor_id: user.id,
      action: `supervisor.${decision}`,
      entity_type: 'idea',
      entity_id: id,
      metadata: { reason, reason_ar },
    })
    .then(
      () => undefined,
      () => undefined
    );

  return NextResponse.json({ ok: true, status: statusMap[decision] });
}
