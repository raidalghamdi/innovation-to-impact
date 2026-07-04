'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAction } from '@/lib/audit';

// Committee decision values match the innovation.committee_decision_type enum
// exactly: {approve, reject, return, study}. Each maps to an ideas.status
// enum value (or null to keep the idea in the committee queue). Not exported
// as a value because a 'use server' module may only export async functions;
// the union type is export-safe (erased at build time).
export type Decision = 'approve' | 'reject' | 'return' | 'study';

const STATUS_BY_DECISION: Record<Decision, string | null> = {
  approve: 'approved',
  reject: 'rejected',
  return: 'returned',
  study: null, // stays in committee
};

export type DecisionResult = { ok: boolean; error?: string; count?: number };

type DecideInput = {
  ideaIds: string[];
  decision: Decision;
  comments: string;
};

// Record a committee decision for one or more ideas. Writes to
// committee_decisions, updates ideas.status (unless 'study' — keeps in queue),
// and logs each decision to the audit trail.
export async function recordDecision(input: DecideInput): Promise<DecisionResult> {
  if (!input.ideaIds.length) return { ok: false, error: 'no_ideas' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const now = new Date().toISOString();
  const rows = input.ideaIds.map((ideaId) => ({
    idea_id: ideaId,
    decision: input.decision,
    comments: input.comments || null,
    decided_by: user.id,
    created_at: now,
  }));

  const { error: insertError } = await supabase.from('committee_decisions').insert(rows);
  if (insertError) {
    // eslint-disable-next-line no-console
    console.error('[recordDecision] insert error:', insertError);
    return { ok: false, error: insertError.message };
  }

  const nextStatus = STATUS_BY_DECISION[input.decision];
  if (nextStatus) {
    const { error: updateError } = await supabase
      .from('ideas')
      .update({ status: nextStatus })
      .in('id', input.ideaIds);
    if (updateError) {
      // eslint-disable-next-line no-console
      console.error('[recordDecision] status update error:', updateError);
      return { ok: false, error: updateError.message };
    }
  }

  await Promise.all(
    input.ideaIds.map((ideaId) =>
      logAction(user.id, `committee.${input.decision}`, 'idea', ideaId, {
        decision: input.decision,
        comments: input.comments || null,
      })
    )
  );

  revalidatePath(`/[locale]/committee`, 'page');
  return { ok: true, count: input.ideaIds.length };
}
