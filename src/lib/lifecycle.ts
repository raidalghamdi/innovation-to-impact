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
