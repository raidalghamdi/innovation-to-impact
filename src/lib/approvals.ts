import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { fanOut } from '@/lib/notifications';

// Multi-step approval chains (see migration 00014). A chain is an ordered list of
// steps; each step needs `min_approvers` approvals from users holding
// `required_role`. An approval_instance binds a chain to one entity and closes
// (approved) when its last step is satisfied, or (rejected) the moment any
// approver rejects.

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type ApprovalDecision = 'approve' | 'reject';

export type ChainStep = {
  id: string;
  chain_id: string;
  step_order: number;
  required_role: string;
  min_approvers: number;
  label_ar: string | null;
  label_en: string | null;
};

export type ApprovalInstance = {
  id: string;
  chain_id: string;
  entity_type: string;
  entity_id: string;
  status: ApprovalStatus;
  opened_at: string;
  decided_at: string | null;
};

export type StepDecision = {
  id: string;
  instance_id: string;
  step_id: string;
  approver_id: string | null;
  decision: ApprovalDecision;
  comment_ar: string | null;
  comment_en: string | null;
  decided_at: string;
};

type Client = SupabaseClient<any, any, any>;

async function resolveClient(client?: Client): Promise<Client | null> {
  if (client) return client;
  return (await createClient()) as Client | null;
}

async function stepsForChain(supabase: Client, chainId: string): Promise<ChainStep[]> {
  const { data } = await supabase
    .from('approval_chain_steps')
    .select('*')
    .eq('chain_id', chainId)
    .order('step_order', { ascending: true });
  return (data as ChainStep[] | null) ?? [];
}

async function chainByCode(
  supabase: Client,
  code: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('approval_chains')
    .select('id')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

async function approvalsByStep(
  supabase: Client,
  instanceId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('approval_step_decisions')
    .select('step_id, decision')
    .eq('instance_id', instanceId);
  const counts = new Map<string, number>();
  for (const d of (data as Pick<StepDecision, 'step_id' | 'decision'>[] | null) ?? []) {
    if (d.decision === 'approve') counts.set(d.step_id, (counts.get(d.step_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * The first step whose min_approvers is not yet satisfied, or null when every
 * step is met (the chain is complete). Steps must be passed in order.
 */
function pendingStep(steps: ChainStep[], approvals: Map<string, number>): ChainStep | null {
  for (const s of steps) {
    if ((approvals.get(s.id) ?? 0) < s.min_approvers) return s;
  }
  return null;
}

/** Fan an `approval_requested` notification to every holder of a step's role. */
async function notifyStepApprovers(
  supabase: Client,
  step: ChainStep,
  entityType: string,
  entityId: string
): Promise<void> {
  const { data } = await supabase.from('user_profiles').select('id').eq('role', step.required_role);
  const ids = ((data as { id: string }[] | null) ?? []).map((r) => r.id);
  if (!ids.length) return;
  await fanOut(
    ids,
    'approval_requested',
    { entityType, entityId, step: step.step_order },
    { client: supabase, link: '/approvals' }
  );
}

/**
 * Create an approval instance for (chain, entity) and notify the first step's
 * approvers. Reuses an existing pending instance for the same triple so the same
 * gate isn't opened twice. Returns the instance id or null when offline.
 */
export async function openApprovalInstance(
  chainCode: string,
  entityType: string,
  entityId: string,
  opts: { actorId?: string | null; client?: Client } = {}
): Promise<string | null> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return null;
  try {
    const chain = await chainByCode(supabase, chainCode);
    if (!chain) return null;

    const { data: existing } = await supabase
      .from('approval_instances')
      .select('id')
      .eq('chain_id', chain.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;

    const { data, error } = await supabase
      .from('approval_instances')
      .insert({ chain_id: chain.id, entity_type: entityType, entity_id: entityId })
      .select('id')
      .maybeSingle();
    if (error || !data) return null;
    const id = (data as { id: string }).id;

    const steps = await stepsForChain(supabase, chain.id);
    if (steps[0]) await notifyStepApprovers(supabase, steps[0], entityType, entityId);

    await logAudit(opts.actorId ?? null, 'approval.opened', 'approval_instance', id, {
      after: { chainCode, entityType, entityId },
    });
    return id;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[openApprovalInstance] failed:', err);
    return null;
  }
}

export type RecordDecisionResult = {
  ok: boolean;
  error?: string;
  instanceStatus?: ApprovalStatus;
  advancedToStep?: number | null;
};

/**
 * Record one approver's decision on a step. A reject closes the instance
 * immediately; an approve that meets the step's min_approvers advances to the
 * next step (notifying its approvers) or closes the instance as approved when it
 * was the last step.
 */
export async function recordDecision(
  instanceId: string,
  stepId: string,
  approverId: string,
  decision: ApprovalDecision,
  comment?: string,
  opts: { client?: Client } = {}
): Promise<RecordDecisionResult> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return { ok: false, error: 'not_configured' };
  try {
    const { data: inst } = await supabase
      .from('approval_instances')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();
    const instance = inst as ApprovalInstance | null;
    if (!instance) return { ok: false, error: 'not_found' };
    if (instance.status !== 'pending') return { ok: false, error: 'not_pending' };

    const { error: insErr } = await supabase.from('approval_step_decisions').insert({
      instance_id: instanceId,
      step_id: stepId,
      approver_id: approverId,
      decision,
      comment_en: comment ?? null,
      comment_ar: comment ?? null,
    });
    if (insErr) return { ok: false, error: insErr.message };

    await logAudit(approverId, `approval.${decision}`, 'approval_instance', instanceId, {
      after: { stepId, decision, comment: comment ?? null },
    });

    if (decision === 'reject') {
      await supabase
        .from('approval_instances')
        .update({ status: 'rejected', decided_at: new Date().toISOString() })
        .eq('id', instanceId);
      return { ok: true, instanceStatus: 'rejected' };
    }

    const steps = await stepsForChain(supabase, instance.chain_id);
    const approvals = await approvalsByStep(supabase, instanceId);
    const next = pendingStep(steps, approvals);

    if (!next) {
      await supabase
        .from('approval_instances')
        .update({ status: 'approved', decided_at: new Date().toISOString() })
        .eq('id', instanceId);
      return { ok: true, instanceStatus: 'approved', advancedToStep: null };
    }

    // Chain still pending — if the freshly-satisfied step handed off to a new
    // step, notify that step's approvers.
    const decidedStep = steps.find((s) => s.id === stepId);
    if (decidedStep && next.step_order > decidedStep.step_order) {
      await notifyStepApprovers(supabase, next, instance.entity_type, instance.entity_id);
    }
    return { ok: true, instanceStatus: 'pending', advancedToStep: next.step_order };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recordDecision] failed:', err);
    return { ok: false, error: 'exception' };
  }
}

/** Withdraw (cancel) a pending approval instance. */
export async function withdrawApprovalInstance(
  id: string,
  opts: { actorId?: string | null; client?: Client } = {}
): Promise<boolean> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return false;
  try {
    await supabase
      .from('approval_instances')
      .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');
    await logAudit(opts.actorId ?? null, 'approval.withdrawn', 'approval_instance', id, {});
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[withdrawApprovalInstance] failed:', err);
    return false;
  }
}

export type PendingApproval = {
  instanceId: string;
  chainId: string;
  entityType: string;
  entityId: string;
  openedAt: string;
  step: ChainStep;
  priorApprovers: string[];
};

/**
 * Approval steps currently waiting on `userId` — pending instances whose current
 * step requires the user's role and on which the user has not already decided.
 */
export async function getPendingApprovals(
  userId: string,
  opts: { client?: Client } = {}
): Promise<PendingApproval[]> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return [];
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (!role) return [];

    const { data: instRows } = await supabase
      .from('approval_instances')
      .select('*')
      .eq('status', 'pending')
      .order('opened_at', { ascending: true });
    const instances = (instRows as ApprovalInstance[] | null) ?? [];
    if (!instances.length) return [];

    const out: PendingApproval[] = [];
    for (const instance of instances) {
      const steps = await stepsForChain(supabase, instance.chain_id);
      const approvals = await approvalsByStep(supabase, instance.id);
      const current = pendingStep(steps, approvals);
      if (!current || current.required_role !== role) continue;

      const { data: mine } = await supabase
        .from('approval_step_decisions')
        .select('id')
        .eq('instance_id', instance.id)
        .eq('step_id', current.id)
        .eq('approver_id', userId)
        .maybeSingle();
      if (mine) continue;

      const { data: prior } = await supabase
        .from('approval_step_decisions')
        .select('approver_id')
        .eq('instance_id', instance.id)
        .eq('step_id', current.id)
        .eq('decision', 'approve');
      const priorApprovers = ((prior as { approver_id: string | null }[] | null) ?? [])
        .map((r) => r.approver_id)
        .filter((x): x is string => Boolean(x));

      out.push({
        instanceId: instance.id,
        chainId: instance.chain_id,
        entityType: instance.entity_type,
        entityId: instance.entity_id,
        openedAt: instance.opened_at,
        step: current,
        priorApprovers,
      });
    }
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getPendingApprovals] failed:', err);
    return [];
  }
}

// Gate rules: which chain (if any) an entity must complete before a target
// lifecycle state is allowed. Consumed by lifecycle.assertApprovalComplete.
const GATE: Record<string, string> = {
  'committee_decision:approved': 'committee-publish',
  'idea:approved': 'idea-approve',
};

/** The chain code required to reach `targetState` on `entityType`, or null. */
export function requiresApproval(entityType: string, targetState: string): string | null {
  return GATE[`${entityType}:${targetState}`] ?? null;
}

/**
 * Whether the approval gate for (chain, entity) is satisfied. The gate only
 * *engages* once a sign-off instance has been opened for the entity:
 *   • no instance opened          → true  (gate not engaged; flow proceeds)
 *   • an approved instance exists  → true  (sign-off complete)
 *   • only pending/rejected exist  → false (sign-off in progress — blocked)
 * Returns true when Supabase is offline or the chain is missing so previews,
 * builds, and the demo path are never blocked by a gate that can't be evaluated.
 */
export async function isApprovalComplete(
  chainCode: string,
  entityType: string,
  entityId: string,
  opts: { client?: Client } = {}
): Promise<boolean> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return true;
  try {
    const chain = await chainByCode(supabase, chainCode);
    if (!chain) return true;
    const { data } = await supabase
      .from('approval_instances')
      .select('status')
      .eq('chain_id', chain.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    const rows = (data as { status: ApprovalStatus }[] | null) ?? [];
    if (!rows.length) return true;
    return rows.some((r) => r.status === 'approved');
  } catch {
    return true;
  }
}
