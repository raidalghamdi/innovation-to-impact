'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { notifyByRole, fanOut, getSupervisorIds } from '@/lib/notifications';
import { openSlaTracker, closeSlaTracker } from '@/lib/sla';
import { EV_CRITERIA, type EvScores } from '@/lib/evaluator-criteria';
import { afterEvaluatorSubmit } from '@/lib/lifecycle-transitions';

export type EvSubmitResult = { ok: boolean; error?: string };

// Persist + submit an evaluator scorecard. Mirrors the wired-up decision path
// of the legacy evaluation action (SLA close/open + judge/supervisor notify) so
// the committee flow keeps working, while using the 4-criterion model.
export async function submitEvaluatorScore(input: {
  ideaId: string;
  scores: EvScores;
  notes: string;
}): Promise<EvSubmitResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Each criterion is scored 0–10; total_score is the average (0–10 scale),
  // matching the overall score shown in the evaluator UI.
  const sum = EV_CRITERIA.reduce((acc, k) => acc + (Number(input.scores[k]) || 0), 0);
  const total = EV_CRITERIA.length ? Math.round((sum / EV_CRITERIA.length) * 100) / 100 : 0;

  const { error } = await supabase.from('evaluations').upsert(
    {
      idea_id: input.ideaId,
      evaluator_id: user.id,
      criteria_scores: input.scores,
      total_score: total,
      comments: input.notes || null,
      conflict_of_interest: false,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'idea_id,evaluator_id' }
  );

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[submitEvaluatorScore] supabase error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'evaluation.submit', 'idea', input.ideaId, {
    after: { total_score: total },
  });

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id')
    .eq('idea_id', input.ideaId)
    .eq('evaluator_id', user.id)
    .maybeSingle();
  const assignmentId = (assignment as { id?: string } | null)?.id;
  if (assignmentId) await closeSlaTracker('evaluation', assignmentId);
  await openSlaTracker('committee', input.ideaId, 'submitted', 'decided');
  await notifyByRole('judge', 'evaluation_completed', { ideaId: input.ideaId });
  const supervisorIds = await getSupervisorIds(supabase);
  if (supervisorIds.length)
    await fanOut(supervisorIds, 'evaluation_completed', { ideaId: input.ideaId }, { link: `/ideas/${input.ideaId}` });

  // T1: if this was the last evaluator, advance the idea to
  // pass_awaiting_attachments / evaluation_failed. Best-effort — a transition
  // failure must never lose the scorecard that was just saved.
  try {
    await afterEvaluatorSubmit(input.ideaId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[submitEvaluatorScore] afterEvaluatorSubmit failed:', err);
  }

  revalidatePath('/[locale]/evaluator', 'page');
  return { ok: true };
}
