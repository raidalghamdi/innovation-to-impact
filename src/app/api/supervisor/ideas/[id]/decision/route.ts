import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { createNotification, fanOut, type NotificationType } from '@/lib/notifications';

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

  let body: { decision?: Decision; reason?: string; reason_ar?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { decision, reason = null, reason_ar = null } = body;
  if (!decision || !['approve', 'reject', 'return'].includes(decision)) {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 });
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
  if (decision === 'approve') update.approved_at = new Date().toISOString();
  if (decision !== 'approve') {
    update.rejection_reason = reason;
    update.rejection_reason_ar = reason_ar;
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
    const submitterId = (ideaRow as { submitter_id?: string } | null)?.submitter_id ?? null;
    const ideaCode = (ideaRow as { code?: string } | null)?.code ?? id;
    const themeId = (ideaRow as { strategic_theme_id?: string } | null)?.strategic_theme_id ?? null;

    const notifType: NotificationType =
      decision === 'approve'
        ? 'idea_approved'
        : decision === 'reject'
          ? 'idea_rejected'
          : 'idea_feedback_requested';
    const link = `/my-ideas/${id}`;

    if (submitterId) {
      await createNotification(
        submitterId,
        notifType,
        { ideaId: id, ideaCode, reason: reason ?? reason_ar ?? '' },
        { email: true, link }
      );
    }

    if (decision === 'approve' && themeId) {
      const { data: trackRows } = await supabase
        .from('track_assignments')
        .select('evaluator_id')
        .eq('theme_id', themeId)
        .eq('status', 'active');
      const evalIds = ((trackRows as { evaluator_id: string }[]) ?? [])
        .map((r) => r.evaluator_id)
        .filter(Boolean);
      if (evalIds.length) {
        await fanOut(evalIds, 'evaluation_assigned', { ideaId: id, ideaCode }, { link: `/evaluation` });
      }
    }
  } catch {
    // Swallow — notifications must never fail the decision request.
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
