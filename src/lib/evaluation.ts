// Shared evaluation constants and pure helpers. Kept out of the server-action
// module because a 'use server' file may only export async functions.

// The five official evaluation criteria and their weights. Total is computed as
// sum(weight * score / 5) * 100 so the display range is 0–100 regardless of the
// 1–5 per-criterion scale.
export const EVALUATION_CRITERIA = [
  { key: 'strategic_alignment', weight: 0.25 },
  { key: 'innovation', weight: 0.2 },
  { key: 'feasibility', weight: 0.2 },
  { key: 'impact', weight: 0.25 },
  { key: 'effort', weight: 0.1 },
] as const;

export type CriteriaScores = Record<string, number>;

export function computeTotal(scores: CriteriaScores): number {
  const raw = EVALUATION_CRITERIA.reduce(
    (sum, c) => sum + ((scores[c.key] ?? 0) / 5) * c.weight,
    0
  );
  return Math.round(raw * 100 * 10) / 10;
}
