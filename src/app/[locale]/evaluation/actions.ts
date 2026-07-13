'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { notifyByRole, fanOut, getSupervisorIds } from '@/lib/notifications';
import { openSlaTracker, closeSlaTracker } from '@/lib/sla';
import { computeTotal, type CriteriaScores } from '@/lib/evaluation';
import { afterEvaluatorSubmit } from '@/lib/lifecycle-transitions';

export type EvaluationResult = { ok: boolean; error?: string };

export type ExistingEvaluation = {
  criteria_scores: CriteriaScores | null;
  comments: string | null;
  conflict_of_interest: boolean;
  submitted_at: string | null;
};

type SaveInput = {
  ideaId: string;
  criteriaScores: CriteriaScores;
  comments: string;
  conflictOfInterest: boolean;
  submit: boolean;
};

// Persist an evaluation. A draft has submitted_at = null; a submitted
// evaluation stamps submitted_at. Upserts on (idea_id, evaluator_id) so a
// reopened draft edits the same row.
export async function saveEvaluation(input: SaveInput): Promise<EvaluationResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const row = {
    idea_id: input.ideaId,
    evaluator_id: user.id,
    criteria_scores: input.criteriaScores,
    total_score: computeTotal(input.criteriaScores),
    comments: input.comments || null,
    conflict_of_interest: input.conflictOfInterest,
    submitted_at: input.submit ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('evaluations')
    .upsert(row, { onConflict: 'idea_id,evaluator_id' });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[saveEvaluation] supabase error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(
    user.id,
    input.submit ? 'evaluation.submit' : 'evaluation.draft',
    'idea',
    input.ideaId,
    { after: { total_score: row.total_score } }
  );

  // On submit: resolve the evaluator's assignment so we close the right
  // evaluation SLA tracker (they're keyed by assignment id), start the committee
  // clock, and alert the judges that a scorecard is ready. Drafts do none of this.
  if (input.submit) {
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
    // Supervisors overseeing screening must also learn an evaluation landed.
    const supervisorIds = await getSupervisorIds(supabase);
    if (supervisorIds.length)
      await fanOut(supervisorIds, 'evaluation_completed', { ideaId: input.ideaId }, { link: `/ideas/${input.ideaId}` });

    // T1: last-evaluator transition. Best-effort — never lose the submission.
    try {
      await afterEvaluatorSubmit(input.ideaId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[saveEvaluation] afterEvaluatorSubmit failed:', err);
    }
  }

  revalidatePath(`/[locale]/evaluation`, 'page');
  return { ok: true };
}

// Fetch the current evaluator's evaluation for a given idea (draft or
// submitted) so the scorecard can hydrate on open (F-17 frontend).
export async function fetchEvaluationForIdea(
  ideaId: string
): Promise<{ ok: boolean; evaluation: ExistingEvaluation | null; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, evaluation: null, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, evaluation: null, error: 'unauthenticated' };

  const { data, error } = await supabase
    .from('evaluations')
    .select('criteria_scores, comments, conflict_of_interest, submitted_at')
    .eq('idea_id', ideaId)
    .eq('evaluator_id', user.id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fetchEvaluationForIdea] supabase error:', error);
    return { ok: false, evaluation: null, error: error.message };
  }

  return { ok: true, evaluation: (data as ExistingEvaluation | null) ?? null };
}
