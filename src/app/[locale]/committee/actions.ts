'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { createNotification, fanOut, getSupervisorIds, type NotificationType } from '@/lib/notifications';
import { closeSlaTracker } from '@/lib/sla';
import {
  assertApprovalComplete,
  assertTransition,
  ApprovalRequiredError,
  LifecycleTransitionError,
  LIFECYCLE_STATES,
  type LifecycleState,
} from '@/lib/lifecycle';

function isLifecycleState(v: string | null): v is LifecycleState {
  return v != null && (LIFECYCLE_STATES as readonly string[]).includes(v);
}

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

// Which notification the submitter receives for each decision.
const NOTIFICATION_BY_DECISION: Record<Decision, NotificationType> = {
  approve: 'idea_approved',
  reject: 'idea_rejected',
  return: 'idea_feedback_requested',
  study: 'committee_decision',
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

  // committee_decisions has no created_at column; decided_at defaults to now()
  // and quorum_met defaults to false, so we omit them from the payload.
  const rows = input.ideaIds.map((ideaId) => ({
    idea_id: ideaId,
    decision: input.decision,
    comments: input.comments || null,
    decided_by: user.id,
  }));

  const { error: insertError } = await supabase.from('committee_decisions').insert(rows);
  if (insertError) {
    // eslint-disable-next-line no-console
    console.error('[recordDecision] insert error:', insertError);
    return { ok: false, error: insertError.message };
  }

  const nextStatus = STATUS_BY_DECISION[input.decision];

  // Snapshot the pre-decision status of each idea so the audit trail records
  // the before/after transition, not just the outcome.
  const priorStatus = new Map<string, string | null>();
  const submitterByIdea = new Map<string, string | null>();
  const { data: priorRows } = await supabase
    .from('ideas')
    .select('id, status, submitter_id')
    .in('id', input.ideaIds);
  for (const row of priorRows ?? []) {
    priorStatus.set(row.id as string, (row.status as string | null) ?? null);
    submitterByIdea.set(row.id as string, (row.submitter_id as string | null) ?? null);
  }

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
      logAudit(user.id, `committee.${input.decision}`, 'idea', ideaId, {
        before: { status: priorStatus.get(ideaId) ?? null },
        after: {
          status: nextStatus ?? priorStatus.get(ideaId) ?? null,
          decision: input.decision,
          comments: input.comments || null,
        },
      })
    )
  );

  // Fan the decision out to stakeholders and close the committee SLA window.
  // Submitter is emailed (it's their idea's outcome); evaluators get an in-app
  // heads-up. All best-effort — notification failures never fail the decision.
  const notifType = NOTIFICATION_BY_DECISION[input.decision];
  const { data: evalRows } = await supabase
    .from('evaluations')
    .select('idea_id, evaluator_id')
    .in('idea_id', input.ideaIds);
  const evaluatorsByIdea = new Map<string, string[]>();
  for (const row of (evalRows as { idea_id: string; evaluator_id: string }[] | null) ?? []) {
    const list = evaluatorsByIdea.get(row.idea_id) ?? [];
    list.push(row.evaluator_id);
    evaluatorsByIdea.set(row.idea_id, list);
  }

  const supervisorIds = await getSupervisorIds(supabase);
  await Promise.all(
    input.ideaIds.flatMap((ideaId) => {
      const payload = { ideaId, decision: input.decision };
      const link = `/ideas/${ideaId}`;
      const submitter = submitterByIdea.get(ideaId);
      const evaluators = evaluatorsByIdea.get(ideaId) ?? [];
      const tasks: Promise<void>[] = [closeSlaTracker('committee', ideaId)];
      if (submitter) tasks.push(createNotification(submitter, notifType, payload, { email: true, link }));
      if (evaluators.length)
        tasks.push(fanOut(evaluators, 'committee_decision', payload, { link }));
      if (supervisorIds.length)
        tasks.push(fanOut(supervisorIds, 'committee_decision', payload, { link: '/supervisor' }));
      return tasks;
    })
  );

  revalidatePath(`/[locale]/committee`, 'page');
  return { ok: true, count: input.ideaIds.length };
}

export type BulkDecisionFailure = { ideaId: string; error: string };
export type BulkDecisionResult = {
  ok: boolean;
  error?: string;
  succeeded: number;
  failures: BulkDecisionFailure[];
};

type BulkDecideInput = {
  ideaIds: string[];
  decision: Decision;
  comment: string;
  locale?: 'ar' | 'en';
};

/**
 * Decide many ideas at once with one shared comment. Unlike recordDecision this
 * guards each idea individually: it checks the lifecycle transition and the
 * approval sign-off gate (assertApprovalComplete) before writing, and collects
 * per-idea failures instead of aborting the whole batch — so a blocked idea
 * doesn't sink the ones that are clear to go. Enforces admin/judge role.
 */
export async function bulkCommitteeDecide(input: BulkDecideInput): Promise<BulkDecisionResult> {
  if (!input.ideaIds.length) return { ok: false, error: 'no_ideas', succeeded: 0, failures: [] };
  if ((input.decision === 'reject' || input.decision === 'return') && !input.comment.trim()) {
    return { ok: false, error: 'comment_required', succeeded: 0, failures: [] };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured', succeeded: 0, failures: [] };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated', succeeded: 0, failures: [] };
  if (user.role !== 'admin' && user.role !== 'judge') {
    return { ok: false, error: 'forbidden', succeeded: 0, failures: [] };
  }

  const nextStatus = STATUS_BY_DECISION[input.decision];
  const notifType = NOTIFICATION_BY_DECISION[input.decision];
  const comments = input.comment.trim() || null;
  const locale = input.locale ?? 'en';

  // Snapshot prior status + submitter per idea for guards, audit, and notify.
  const priorStatus = new Map<string, string | null>();
  const submitterByIdea = new Map<string, string | null>();
  const { data: priorRows } = await supabase
    .from('ideas')
    .select('id, status, submitter_id')
    .in('id', input.ideaIds);
  for (const row of priorRows ?? []) {
    priorStatus.set(row.id as string, (row.status as string | null) ?? null);
    submitterByIdea.set(row.id as string, (row.submitter_id as string | null) ?? null);
  }

  const failures: BulkDecisionFailure[] = [];
  let succeeded = 0;

  for (const ideaId of input.ideaIds) {
    const from = priorStatus.get(ideaId) ?? null;
    try {
      // Lifecycle guard — only when both endpoints are lifecycle states (the
      // ideas.status enum overlaps but isn't identical, so skip when it isn't).
      if (nextStatus && isLifecycleState(from) && isLifecycleState(nextStatus)) {
        assertTransition(from, nextStatus, locale);
      }
      // Sign-off gate — throws ApprovalRequiredError when a committee-publish
      // chain is engaged for this idea but not yet approved.
      if (nextStatus) {
        await assertApprovalComplete('committee_decision', nextStatus, ideaId, locale);
      }

      const { error: insertError } = await supabase.from('committee_decisions').insert({
        idea_id: ideaId,
        decision: input.decision,
        comments,
        decided_by: user.id,
      });
      if (insertError) throw new Error(insertError.message);

      if (nextStatus) {
        const { error: updateError } = await supabase
          .from('ideas')
          .update({ status: nextStatus })
          .eq('id', ideaId);
        if (updateError) throw new Error(updateError.message);
      }

      await logAudit(user.id, `committee.${input.decision}`, 'idea', ideaId, {
        before: { status: from },
        after: { status: nextStatus ?? from, decision: input.decision, comments },
      });

      const tasks: Promise<void>[] = [closeSlaTracker('committee', ideaId)];
      const submitter = submitterByIdea.get(ideaId);
      const payload = { ideaId, decision: input.decision };
      const link = `/ideas/${ideaId}`;
      if (submitter) tasks.push(createNotification(submitter, notifType, payload, { email: true, link }));
      const supervisorIds = await getSupervisorIds(supabase);
      if (supervisorIds.length)
        tasks.push(fanOut(supervisorIds, 'committee_decision', payload, { link: '/supervisor' }));
      await Promise.all(tasks);

      succeeded += 1;
    } catch (err) {
      const message =
        err instanceof ApprovalRequiredError || err instanceof LifecycleTransitionError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'error';
      failures.push({ ideaId, error: message });
    }
  }

  revalidatePath(`/[locale]/committee`, 'page');
  return { ok: failures.length === 0, succeeded, failures };
}
