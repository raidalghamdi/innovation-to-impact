'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { notifyByRole, fanOut, getSupervisorIds } from '@/lib/notifications';
import { openSlaTracker, closeSlaTracker } from '@/lib/sla';
import { EV_CRITERIA, type EvScores } from '@/lib/evaluator-criteria';

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

  const total = EV_CRITERIA.reduce((sum, k) => sum + (Number(input.scores[k]) || 0), 0);

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
    await fanOut(supervisorIds, 'evaluation_completed', { ideaId: input.ideaId }, { link: '/supervisor' });

  revalidatePath('/[locale]/evaluator', 'page');
  return { ok: true };
}
