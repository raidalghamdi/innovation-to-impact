// src/lib/idea-journey.ts
// -----------------------------------------------------------------------------
// Idea journey — derive the eight-stage lifecycle position of an idea from its
// REAL state (status + related rows) instead of a single stored column.
//
// Eight stages, in two groups:
//   Program stages       — 1 submission, 2 screening, 3 evaluation, 4 committee,
//                          5 approval
//   Post-program stages  — 6 pilot, 7 measurement, 8 scale & adoption
//
// Each stage carries one of four visual states: completed / current / stopped /
// upcoming. The transition rules (A–K) map the authoritative signals — status,
// assignments, evaluations (score) and committee decisions — onto those states.
// -----------------------------------------------------------------------------

export type StageState = 'completed' | 'current' | 'stopped' | 'upcoming';
export type StageLabel = { ar: string; en: string };

export type JourneyStage = {
  index: number; // 0-based (0..7); stage number shown to the user is index + 1
  state: StageState;
  completedAt?: Date;
  label: StageLabel;
};

export type IdeaJourney = {
  /** 0-based index of the active stage (current or stopped), else last completed. */
  currentStage: number;
  /** True when the idea is halted at a stage (rejected / failed / withdrawn). */
  stopped: boolean;
  /** Average evaluation score on a 0–10 scale, null when no evaluation exists. */
  evaluationScore: number | null;
  stages: JourneyStage[];
};

// Eight stages, in order (ar + en). Labels mirror the `stages` i18n namespace.
export const STAGE_LABELS: readonly StageLabel[] = [
  { ar: 'تقديم الفكرة', en: 'Idea Submission' },
  { ar: 'الفرز الأولي', en: 'Initial Screening' },
  { ar: 'التقييم الفني', en: 'Technical Evaluation' },
  { ar: 'مراجعة اللجنة', en: 'Committee Review' },
  { ar: 'الاعتماد', en: 'Approval' },
  { ar: 'التنفيذ التجريبي', en: 'Pilot Implementation' },
  { ar: 'القياس والأثر', en: 'Measurement & Impact' },
  { ar: 'التوسّع والاعتماد', en: 'Scale & Adoption' },
] as const;

// Minimal, defensive input shapes — only the fields we actually read.
export type IdeaInput = {
  status?: string | null;
  current_stage?: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type AssignmentInput = { created_at?: string | null };
export type EvaluationInput = {
  submitted_at?: string | null;
  total_score?: number | null;
  criteria_scores?: Record<string, unknown> | null;
};
export type CommitteeDecisionInput = { decision?: string | null; decided_at?: string | null };

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

// A single evaluation's score on a 0–10 scale. Criteria are each scored 0–10 and
// averaged, so we derive the score from `criteria_scores` when present (robust to
// how `total_score` happens to be stored) and fall back to `total_score`.
function scoreOfEvaluation(e: EvaluationInput): number | null {
  const cs = e.criteria_scores;
  if (cs && typeof cs === 'object') {
    const vals = Object.values(cs)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    if (vals.length > 0) return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  if (typeof e.total_score === 'number' && Number.isFinite(e.total_score)) return e.total_score;
  return null;
}

function computeEvaluationScore(evaluations: EvaluationInput[]): number | null {
  const scores = evaluations
    .map(scoreOfEvaluation)
    .filter((n): n is number => n != null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Compute the eight-stage journey for an idea from its real, cross-table state.
 * Implements transition rules A–K (see project brief). Stage positions are
 * expressed here 1-based (1..8) for readability and converted to 0-based indices
 * when the per-stage list is built.
 */
export function computeIdeaStage(
  idea: IdeaInput,
  assignments: AssignmentInput[] = [],
  evaluations: EvaluationInput[] = [],
  committeeDecisions: CommitteeDecisionInput[] = [],
  evaluationScoreOverride?: number
): IdeaJourney {
  const status = (idea.status ?? 'draft').toLowerCase();
  const evaluationScore =
    evaluationScoreOverride ?? computeEvaluationScore(evaluations);

  const hasAssignment = assignments.length > 0;
  const hasEvaluation = evaluations.length > 0;
  const committeeApprove = committeeDecisions.some(
    (c) => (c.decision ?? '').toLowerCase() === 'approve'
  );
  const committeeReject = committeeDecisions.some(
    (c) => (c.decision ?? '').toLowerCase() === 'reject'
  );
  const passed = evaluationScore != null && evaluationScore >= 7;
  const failed = evaluationScore != null && evaluationScore < 7;

  // completedUpTo — highest 1-based stage rendered green (completed).
  // current      — 1-based stage rendered yellow (0 = none).
  // stopped      — 1-based stage rendered red (0 = none).
  let completedUpTo = 0;
  let current = 0;
  let stopped = 0;

  if (status === 'closed' || status === 'archived') {
    // Rule J — fully completed.
    completedUpTo = 8;
  } else if (status === 'in_implementation') {
    // Rule J
    completedUpTo = 7;
    current = 8;
  } else if (status === 'benefits_tracking') {
    // Rule J
    completedUpTo = 6;
    current = 7;
  } else if (status === 'in_pilot') {
    // Rule J
    completedUpTo = 5;
    current = 6;
  } else if (status === 'approved' || committeeApprove) {
    // Rule H — final committee approval. Stage 5 completed, stage 6 (pilot)
    // becomes the current active stage until in_pilot/benefits_tracking kicks in.
    completedUpTo = 5;
    current = 6;
  } else if (status === 'withdrawn') {
    // Rule K — the stage that was active becomes stopped; earlier stay completed.
    let active = 2;
    if (committeeApprove) active = 5;
    else if (passed) active = 4;
    else if (hasEvaluation || hasAssignment) active = 3;
    stopped = active;
    completedUpTo = active - 1;
  } else if (committeeReject && status === 'rejected') {
    // Rule I — committee rejected.
    completedUpTo = 3;
    stopped = 4;
  } else if (failed) {
    // Rule F — evaluator scored the idea below the pass threshold.
    completedUpTo = 2;
    stopped = 3;
  } else if (status === 'rejected') {
    // Rule C — supervisor rejected during screening.
    completedUpTo = 1;
    stopped = 2;
  } else if (status === 'committee') {
    // Rule G — committee reviewing.
    completedUpTo = 3;
    current = 4;
  } else if (passed) {
    // Rule E — evaluator passed the idea; awaiting committee.
    completedUpTo = 3;
    current = 4;
  } else if (hasAssignment || status === 'assigned' || status === 'evaluation') {
    // Rule B — supervisor approved; assigned to an evaluator, not yet evaluated.
    completedUpTo = 2;
    current = 3;
  } else if (status === 'returned') {
    // Rule D — returned for edits (needs work, not a final rejection).
    completedUpTo = 1;
    current = 2;
  } else if (
    status === 'submitted' ||
    status === 'screening' ||
    status === 'needs_completion'
  ) {
    // Rule A — submitted, awaiting supervisor screening.
    completedUpTo = 1;
    current = 2;
  } else {
    // draft / unknown — sitting at submission.
    completedUpTo = 0;
    current = 1;
  }

  // Per-stage completion timestamps (best-effort; not all designs render them).
  const submittedAt = toDate(idea.submitted_at) ?? toDate(idea.created_at);
  const assignmentAt = earliest(assignments.map((a) => toDate(a.created_at)));
  const evaluationAt = latest(evaluations.map((e) => toDate(e.submitted_at)));
  const approvalAt = latest(
    committeeDecisions
      .filter((c) => (c.decision ?? '').toLowerCase() === 'approve')
      .map((c) => toDate(c.decided_at))
  );
  const updatedAt = toDate(idea.updated_at);

  const completedAtFor = (index: number): Date | undefined => {
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
      default:
        return updatedAt;
    }
  };

  const stages: JourneyStage[] = STAGE_LABELS.map((label, i) => {
    const oneBased = i + 1;
    let state: StageState;
    if (oneBased === stopped) state = 'stopped';
    else if (oneBased <= completedUpTo) state = 'completed';
    else if (oneBased === current) state = 'current';
    else state = 'upcoming';
    return {
      index: i,
      state,
      label,
      completedAt: state === 'completed' ? completedAtFor(i) : undefined,
    };
  });

  const activeOneBased = stopped || current || completedUpTo;
  return {
    currentStage: Math.max(0, activeOneBased - 1),
    stopped: stopped > 0,
    evaluationScore,
    stages,
  };
}
