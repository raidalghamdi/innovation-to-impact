// Evaluator → strategic-track (theme) assignment lookup (R43). Reads
// innovation.evaluator_track_assignments to learn which tracks a given
// evaluator may review. The table is optional: when it has not shipped yet the
// query errors and we report `configured: false` so existing evaluators keep
// their prior (unfiltered) behavior and are never locked out.
//
// Column names are tolerated defensively — the track column may be exposed as
// theme_id / track_id / strategic_theme_id and the evaluator column as
// evaluator_id / user_id — so this helper survives minor schema drift.
// Follows the defensive style of src/lib/admin-settings.ts.
import { createClient } from '@/lib/supabase/server';

export type EvaluatorTrackResult = { configured: boolean; themeIds: string[] };

const TRACK_COLUMNS = ['theme_id', 'track_id', 'strategic_theme_id'] as const;
const EVALUATOR_COLUMNS = ['evaluator_id', 'user_id'] as const;

export async function getEvaluatorTrackThemeIds(
  evaluatorId: string
): Promise<EvaluatorTrackResult> {
  if (!evaluatorId) return { configured: false, themeIds: [] };

  const supabase = await createClient();
  if (!supabase) return { configured: false, themeIds: [] };

  try {
    // Try each candidate evaluator column until one resolves without error.
    // A missing table surfaces as an error on every attempt → not configured.
    let rows: Record<string, unknown>[] | null = null;
    for (const col of EVALUATOR_COLUMNS) {
      const { data, error } = await supabase
        .from('evaluator_track_assignments')
        .select('*')
        .eq(col, evaluatorId);
      if (!error) {
        rows = (data as Record<string, unknown>[]) ?? [];
        break;
      }
    }

    if (rows === null) return { configured: false, themeIds: [] };

    // Table exists → configured, even when the evaluator has zero rows.
    const seen = new Set<string>();
    for (const row of rows) {
      for (const col of TRACK_COLUMNS) {
        const value = row[col];
        if (typeof value === 'string' && value.length > 0) {
          seen.add(value);
        }
      }
    }

    return { configured: true, themeIds: Array.from(seen) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getEvaluatorTrackThemeIds] threw:', err);
    return { configured: false, themeIds: [] };
  }
}
