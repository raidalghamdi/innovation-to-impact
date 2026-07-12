// src/lib/idea-journey.ts
// -----------------------------------------------------------------------------
// Idea journey — derive the six-stage lifecycle position of an idea from its
// REAL state (status + related rows) instead of a single stored column.
//
// The bug this fixes: the idea-detail Timeline was pinned to `ideas.current_stage`,
// which does not advance as an idea moves supervisor → evaluator → committee →
// approval. Here we recompute the active stage from the authoritative signals:
//   - ideas.status                    (primary progression signal)
//   - assignments (row exists)        (idea handed to an owner/evaluator)
//   - evaluations (row exists)        (evaluator submitted a scorecard)
//   - committee_decisions (approve)   (committee approved)
//
// We take the FURTHEST stage implied by any signal, so a late-arriving status
// update or a stale current_stage can never drag the Timeline backwards.
// -----------------------------------------------------------------------------

export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type StageState = 'completed' | 'current' | 'upcoming';
export type StageLabel = { ar: string; en: string };

export type JourneyStage = {
  index: StageIndex;
  state: StageState;
  completedAt?: Date;
  label: StageLabel;
};

export type IdeaJourney = {
  currentStage: StageIndex;
  /** True when the idea is halted (rejected / returned / withdrawn / on hold). */
  stopped: boolean;
  stages: JourneyStage[];
};

// Six stages, in order (ar + en). Index 0 = submission, 5 = hackathon day.
export const STAGE_LABELS: readonly StageLabel[] = [
  { ar: 'تقديم الفكرة', en: 'Idea Submission' },
  { ar: 'الفرز الأولي', en: 'Initial Screening' },
  { ar: 'التقييم الفني', en: 'Technical Evaluation' },
  { ar: 'مراجعة اللجنة', en: 'Committee Review' },
  { ar: 'الاعتماد النهائي', en: 'Final Approval' },
  { ar: 'يوم الهاكاثون', en: 'Hackathon Day' },
] as const;

// Minimal, defensive input shapes — only the fields we actually read. The real
// rows carry more columns; callers may pass them through untouched.
export type IdeaInput = {
  status?: string | null;
  current_stage?: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type AssignmentInput = { created_at?: string | null };
export type EvaluationInput = { submitted_at?: string | null };
export type CommitteeDecisionInput = { decision?: string | null; decided_at?: string | null };

const STOPPED_STATUSES = new Set(['rejected', 'returned', 'withdrawn', 'on_hold']);

// Map the DB idea_status enum onto the stage the idea is CURRENTLY in.
// Values not listed fall through to the row-signal logic below.
const STATUS_STAGE: Record<string, StageIndex> = {
  draft: 0,
  submitted: 1,
  screening: 1,
  needs_completion: 1,
  returned: 1,
  assigned: 2,
  evaluation: 2,
  committee: 3,
  approved: 4,
  rejected: 4,
  in_pilot: 5,
  in_implementation: 5,
  benefits_tracking: 5,
  closed: 5,
  archived: 5,
};

function toDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function earliest(dates: Array<Date | undefined>): Date | undefined {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

function latest(dates: Array<Date | undefined>): Date | undefined {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}

function clampStage(n: number): StageIndex {
  const c = Math.max(0, Math.min(5, Math.trunc(n)));
  return c as StageIndex;
}

/**
 * Compute the six-stage journey for an idea from its real, cross-table state.
 * The active stage is the furthest stage implied by status OR any related row.
 */
export function computeIdeaStage(
  idea: IdeaInput,
  assignments: AssignmentInput[] = [],
  evaluations: EvaluationInput[] = [],
  committeeDecisions: CommitteeDecisionInput[] = []
): IdeaJourney {
  const status = (idea.status ?? 'draft').toLowerCase();
  const stopped = STOPPED_STATUSES.has(status);

  const approved = committeeDecisions.some(
    (c) => (c.decision ?? '').toLowerCase() === 'approve'
  );
  const hasEvaluation = evaluations.length > 0;
  const hasAssignment = assignments.length > 0;

  // Furthest stage implied by each independent signal.
  let currentStage = STATUS_STAGE[status] ?? 0;
  if (hasAssignment) currentStage = Math.max(currentStage, 2) as StageIndex;
  if (hasEvaluation) currentStage = Math.max(currentStage, 3) as StageIndex;
  if (approved) currentStage = Math.max(currentStage, 4) as StageIndex;
  currentStage = clampStage(currentStage);

  // Per-stage completion timestamps, from whichever concrete signal we have.
  const submittedAt = toDate(idea.submitted_at) ?? toDate(idea.created_at);
  const assignmentAt = earliest(assignments.map((a) => toDate(a.created_at)));
  const evaluationAt = latest(evaluations.map((e) => toDate(e.submitted_at)));
  const approvalAt = latest(
    committeeDecisions
      .filter((c) => (c.decision ?? '').toLowerCase() === 'approve')
      .map((c) => toDate(c.decided_at))
  );
  const updatedAt = toDate(idea.updated_at);

  const completedAtFor = (index: StageIndex): Date | undefined => {
    switch (index) {
      case 0:
        return submittedAt;
      case 1:
        return assignmentAt ?? submittedAt;
      case 2:
        return assignmentAt;
      case 3:
        return evaluationAt;
      case 4:
        return approvalAt ?? updatedAt;
      case 5:
        return updatedAt;
      default:
        return undefined;
    }
  };

  const stages: JourneyStage[] = STAGE_LABELS.map((label, i) => {
    const index = i as StageIndex;
    const state: StageState =
      index < currentStage ? 'completed' : index === currentStage ? 'current' : 'upcoming';
    return {
      index,
      state,
      label,
      completedAt: state === 'completed' ? completedAtFor(index) : undefined,
    };
  });

  return { currentStage, stopped, stages };
}
