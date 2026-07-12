'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { fanOut } from '@/lib/notifications';

export type WithdrawResult = { ok: boolean; error?: string };

/**
 * Soft-withdraw an idea. Sets status='withdrawn' so the row stays queryable for
 * history/audit while dropping out of active queues. Guards:
 *   - caller must be the submitter
 *   - idea must still be in a pre-evaluator status
 *     (draft / submitted / screening / needs_completion / returned)
 *   - idea must not already be withdrawn
 *
 * Once a supervisor assigns the idea to an evaluator (status='evaluation' or
 * later), withdrawal is locked — the check is on the real workflow `status`,
 * NOT `current_stage`, which does not reliably advance in the database.
 *
 * Admin-reversible by design: nothing here prevents an admin from flipping the
 * status back later. On success, assigned evaluators are notified so their
 * queues can drop the item, and the change is written to the audit log.
 */
const WITHDRAWABLE_STATUSES = new Set([
  'draft',
  'submitted',
  'screening',
  'needs_completion',
  'returned',
]);
export async function withdrawIdea(ideaId: string): Promise<WithdrawResult> {
  if (!ideaId) return { ok: false, error: 'missing_id' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Verify ownership + stage in one round trip so we can't race a stage-advance.
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('id, submitter_id, current_stage, status')
    .eq('id', ideaId)
    .maybeSingle();

  if (fetchErr) {
    // eslint-disable-next-line no-console
    console.error('[withdrawIdea] fetch error:', fetchErr);
    return { ok: false, error: fetchErr.message };
  }
  if (!idea) return { ok: false, error: 'not_found' };

  const row = idea as {
    id: string;
    submitter_id: string | null;
    current_stage: number;
    status: string;
  };

  if (row.submitter_id !== user.id) return { ok: false, error: 'not_owner' };
  if (row.status === 'withdrawn') return { ok: false, error: 'already_withdrawn' };
  if (!WITHDRAWABLE_STATUSES.has(row.status)) return { ok: false, error: 'stage_locked' };

  const { error: updateErr } = await supabase
    .from('ideas')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', ideaId)
    .eq('submitter_id', user.id); // defense in depth: RLS should already enforce this

  if (updateErr) {
    // eslint-disable-next-line no-console
    console.error('[withdrawIdea] update error:', updateErr);
    return { ok: false, error: updateErr.message };
  }

  await logAudit(user.id, 'idea.withdrawn', 'idea', ideaId, {
    before: { status: row.status, current_stage: row.current_stage },
    after: { status: 'withdrawn' },
  });

  // Best-effort fan-out to any evaluators already assigned. If assignments
  // aren't set up yet (early-stage idea) this returns an empty list and no-ops.
  try {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('evaluator_id')
      .eq('idea_id', ideaId);
    const evaluatorIds = ((assignments as { evaluator_id: string | null }[] | null) ?? [])
      .map((a) => a.evaluator_id)
      .filter((id): id is string => Boolean(id));
    if (evaluatorIds.length > 0) {
      await fanOut(evaluatorIds, 'idea_rejected', {
        ideaId,
        reason: 'withdrawn_by_submitter',
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[withdrawIdea] notify failed:', err);
  }

  revalidatePath('/[locale]/my-ideas', 'page');
  revalidatePath(`/[locale]/ideas/${ideaId}`, 'page');
  return { ok: true };
}
