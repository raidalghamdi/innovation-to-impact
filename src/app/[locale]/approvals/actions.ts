'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/user';
import { recordDecision, type ApprovalDecision } from '@/lib/approvals';

export type ApprovalActionResult = {
  ok: boolean;
  error?: string;
  succeeded?: number;
  failures?: { instanceId: string; error: string }[];
};

// A single (instance, step) target the caller is deciding on.
export type ApprovalTarget = { instanceId: string; stepId: string };

export async function decideApprovalAction(
  target: ApprovalTarget,
  decision: ApprovalDecision,
  comment?: string
): Promise<ApprovalActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const res = await recordDecision(target.instanceId, target.stepId, user.id, decision, comment);
  revalidatePath('/[locale]/approvals', 'page');
  return { ok: res.ok, error: res.error };
}

/**
 * Bulk approve/reject many pending steps with one shared comment. Each decision
 * is recorded independently; individual failures are collected and returned so
 * the UI can report partial success rather than failing the whole batch.
 */
export async function bulkDecideApprovalsAction(
  targets: ApprovalTarget[],
  decision: ApprovalDecision,
  comment?: string
): Promise<ApprovalActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  if (!targets.length) return { ok: false, error: 'no_targets' };

  const failures: { instanceId: string; error: string }[] = [];
  let succeeded = 0;
  for (const target of targets) {
    const res = await recordDecision(target.instanceId, target.stepId, user.id, decision, comment);
    if (res.ok) succeeded += 1;
    else failures.push({ instanceId: target.instanceId, error: res.error ?? 'error' });
  }

  revalidatePath('/[locale]/approvals', 'page');
  return { ok: failures.length === 0, succeeded, failures };
}
