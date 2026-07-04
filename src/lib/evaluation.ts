// Shared evaluation constants and pure helpers. Kept out of the server-action
// module because a 'use server' file may only export async functions.

// The five official evaluation criteria. Each scored 1–5. The total is a
// simple sum (5–25), no weighting — weights and 'weighted total' language
// were removed per the F-14 humanization spec.
export const EVALUATION_CRITERIA = [
  { key: 'strategic_alignment' },
  { key: 'feasibility' },
  { key: 'impact' },
  { key: 'innovation' },
  { key: 'cost_benefit' },
] as const;

export const MAX_TOTAL = EVALUATION_CRITERIA.length * 5;

export type CriteriaScores = Record<string, number>;

export function computeTotal(scores: CriteriaScores): number {
  return EVALUATION_CRITERIA.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0);
}
