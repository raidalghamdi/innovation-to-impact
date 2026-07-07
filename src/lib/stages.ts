// src/lib/stages.ts
// -----------------------------------------------------------------------------
// Stage / phase numbering helpers.
//
// The database stores phase indexes as 0..6 (zero-based). Users find that
// confusing — they think in terms of "Stage 1" through "Stage 7". This module
// centralizes the display-only offset so we never accidentally mutate the
// stored value.
//
// RULES:
//   - Reads that come from the DB → NEVER modify.
//   - Any string shown to a user → run through formatStageDisplay() or
//     stageDisplayNumber() BEFORE rendering.
//   - Ordering / comparisons / persistence → keep the stored (0-based) value.
// -----------------------------------------------------------------------------

/** Total number of phases in the program. */
export const TOTAL_PHASES = 7;

/**
 * Convert a stored zero-based phase index (0..6) into the user-facing
 * one-based number (1..7). Values outside the valid range are clamped so
 * the UI can never render "Stage 0" or "Stage 8".
 */
export function stageDisplayNumber(storedIndex: number | null | undefined): number {
  if (typeof storedIndex !== 'number' || Number.isNaN(storedIndex)) return 1;
  const clamped = Math.max(0, Math.min(TOTAL_PHASES - 1, Math.trunc(storedIndex)));
  return clamped + 1;
}

/**
 * Format a stored phase index as a plain string ("1".."7") for direct
 * embedding into template literals: `Stage ${formatStageDisplay(idx)}`.
 */
export function formatStageDisplay(storedIndex: number | null | undefined): string {
  return String(stageDisplayNumber(storedIndex));
}

/**
 * Format as "1 / 7", "2 / 7", ... — useful for progress indicators.
 */
export function formatStageProgress(storedIndex: number | null | undefined): string {
  return `${stageDisplayNumber(storedIndex)} / ${TOTAL_PHASES}`;
}
