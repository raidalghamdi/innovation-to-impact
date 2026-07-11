// Evaluation criteria — Round 29 unification.
//
// Single source of truth for the evaluator score sheet, matching the five
// criteria published on the public landing page ("معايير التقييم"). Weights
// are intentionally NOT stored here — Round 29 requirement 5 explicitly said
// "اعتماد الخمسة الظاهرة في الصورة بدون النسب" — each criterion is scored
// 0–10 (step 0.5) and averaged.
//
// Order matches the landing page: 01 innovation, 02 impact, 03 execution,
// 04 scalability, 05 presentation. Keys are stored inside the existing
// innovation.evaluations.criteria_scores JSONB column — no schema change.
// Any pre-Round-29 rows that used the old four-criteria set (innovation /
// feasibility / impact / execution) still render safely because we default
// missing keys to 0 at read time.
export const EV_CRITERIA = [
  'innovation',
  'impact',
  'execution',
  'scalability',
  'presentation',
] as const;
export type EvCriterion = (typeof EV_CRITERIA)[number];
export type EvScores = Record<EvCriterion, number>;
