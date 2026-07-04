// Idea lifecycle state machine (Phase L).
// Mirrors the lifecycle_status check constraint in migration 00004.

export const LIFECYCLE_STATES = [
  'draft',
  'submitted',
  'under_review',
  'feedback_requested',
  'revised',
  'approved',
  'rejected',
  'pilot',
  'implemented',
  'archived',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

// Allowed transitions between states.
export const TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  draft: ['submitted', 'archived'],
  submitted: ['under_review', 'rejected', 'archived'],
  under_review: ['feedback_requested', 'approved', 'rejected', 'archived'],
  feedback_requested: ['revised', 'archived'],
  revised: ['under_review', 'archived'],
  approved: ['pilot', 'archived'],
  rejected: ['archived'],
  pilot: ['implemented', 'archived'],
  implemented: ['archived'],
  archived: [],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// Thrown when a lifecycle_status write attempts an illegal transition. Carries
// bilingual messages so callers can surface the right one. Pattern mirrors the
// PdcaTransitionService guard in cx-platform-v2.
export class LifecycleTransitionError extends Error {
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly messages: { ar: string; en: string };

  constructor(from: LifecycleState, to: LifecycleState) {
    const messages = {
      en: `Illegal lifecycle transition: "${from}" → "${to}".`,
      ar: `انتقال غير مسموح في دورة الحياة: من "${from}" إلى "${to}".`,
    };
    super(messages.en);
    this.name = 'LifecycleTransitionError';
    this.from = from;
    this.to = to;
    this.messages = messages;
  }
}

// Guard a lifecycle_status write. Throws LifecycleTransitionError when the
// transition is not in TRANSITIONS; otherwise returns the localized success is
// implicit (no return value). Pass a locale to pick which bilingual message the
// thrown error surfaces first via `.message`.
export function assertTransition(
  from: LifecycleState,
  to: LifecycleState,
  locale?: 'ar' | 'en'
): void {
  if (!canTransition(from, to)) {
    const err = new LifecycleTransitionError(from, to);
    if (locale === 'ar') err.message = err.messages.ar;
    throw err;
  }
}

// Thrown when a gated transition is attempted before its approval chain is
// complete (see src/lib/approvals.ts). Bilingual, mirroring
// LifecycleTransitionError so callers can surface the right message.
export class ApprovalRequiredError extends Error {
  readonly entityType: string;
  readonly targetState: string;
  readonly chainCode: string;
  readonly messages: { ar: string; en: string };

  constructor(entityType: string, targetState: string, chainCode: string) {
    const messages = {
      en: `Approval chain "${chainCode}" must be completed before "${entityType}" can move to "${targetState}".`,
      ar: `يجب إكمال سلسلة الموافقات "${chainCode}" قبل نقل "${entityType}" إلى "${targetState}".`,
    };
    super(messages.en);
    this.name = 'ApprovalRequiredError';
    this.entityType = entityType;
    this.targetState = targetState;
    this.chainCode = chainCode;
    this.messages = messages;
  }
}

/**
 * Guard a gated transition: if `targetState` on `entityType` requires an approval
 * chain (per src/lib/approvals GATE) and no approved instance exists, throw
 * ApprovalRequiredError. No-op for ungated transitions. Approvals are resolved
 * via a dynamic import so this module stays free of a server-only dependency at
 * load time (keeps the pure state-machine importable in tests).
 */
export async function assertApprovalComplete(
  entityType: string,
  targetState: string,
  entityId: string,
  locale?: 'ar' | 'en'
): Promise<void> {
  const { requiresApproval, isApprovalComplete } = await import('@/lib/approvals');
  const chainCode = requiresApproval(entityType, targetState);
  if (!chainCode) return;
  const done = await isApprovalComplete(chainCode, entityType, entityId);
  if (!done) {
    const err = new ApprovalRequiredError(entityType, targetState, chainCode);
    if (locale === 'ar') err.message = err.messages.ar;
    throw err;
  }
}

// Evaluator recommendation -> resulting lifecycle state.
export type Recommendation = 'approve' | 'revise' | 'reject' | 'escalate';

export function recommendationToState(rec: Recommendation): LifecycleState {
  switch (rec) {
    case 'approve':
      return 'approved';
    case 'revise':
      return 'feedback_requested';
    case 'reject':
      return 'rejected';
    case 'escalate':
      // stays under committee review
      return 'under_review';
  }
}

export const STATE_COLORS: Record<LifecycleState, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-brand-cyan-light text-brand-teal',
  under_review: 'bg-amber-100 text-amber-800',
  feedback_requested: 'bg-orange-100 text-orange-800',
  revised: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  pilot: 'bg-purple-100 text-purple-700',
  implemented: 'bg-green-600 text-white',
  archived: 'bg-gray-200 text-gray-600',
};
