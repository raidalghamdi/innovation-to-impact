// B4 evaluation criteria — the four the evaluator mockup exposes. Stored as
// keys inside the existing innovation.evaluations.criteria_scores JSONB column
// (no schema change). Each is scored 0–10 (step 0.5); total_score is their sum
// (0–40). Kept in a plain module (not the 'use server' actions file, which may
// only export async functions).
export const EV_CRITERIA = ['innovation', 'feasibility', 'impact', 'execution'] as const;
export type EvCriterion = (typeof EV_CRITERIA)[number];
export type EvScores = Record<EvCriterion, number>;
