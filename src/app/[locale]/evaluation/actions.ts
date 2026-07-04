'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAction } from '@/lib/audit';
import { computeTotal, type CriteriaScores } from '@/lib/evaluation';

export type EvaluationResult = { ok: boolean; error?: string };

type SaveInput = {
  ideaId: string;
  criteriaScores: CriteriaScores;
  comments: string;
  conflictOfInterest: boolean;
  submit: boolean;
};

// Persist an evaluation. A draft has submitted_at = null; a submitted
// evaluation stamps submitted_at. A conflict-of-interest declaration stores
// null scores/total and is always treated as submitted so the idea leaves the
// evaluator's queue. Upserts on (idea_id, evaluator_id).
export async function saveEvaluation(input: SaveInput): Promise<EvaluationResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const conflict = input.conflictOfInterest;
  const submitted = conflict || input.submit;

  const row = {
    idea_id: input.ideaId,
    evaluator_id: user.id,
    criteria_scores: conflict ? null : input.criteriaScores,
    total_score: conflict ? null : computeTotal(input.criteriaScores),
    comments: input.comments || null,
    conflict_of_interest: conflict,
    submitted_at: submitted ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('evaluations')
    .upsert(row, { onConflict: 'idea_id,evaluator_id' });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[saveEvaluation] supabase error:', error);
    return { ok: false, error: error.message };
  }

  await logAction(
    user.id,
    conflict ? 'evaluation.conflict' : submitted ? 'evaluation.submit' : 'evaluation.draft',
    'idea',
    input.ideaId,
    { total_score: row.total_score, conflict_of_interest: conflict }
  );

  revalidatePath(`/[locale]/evaluation`, 'page');
  return { ok: true };
}
