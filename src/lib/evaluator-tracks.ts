// Evaluator → strategic-track (theme) assignment lookup (R45.6).
//
// Source of truth is innovation.track_assignments — the same table the
// supervisor writes to from /supervisor "تعيين المسارات". A parallel table
// (evaluator_track_assignments) existed but was never populated; reading from
// it was the reason evaluators saw "لا توجد محاور مُسندة" while the supervisor
// clearly saw the assignment on their side.
//
// Row shape (innovation.track_assignments):
//   id, theme_id, evaluator_id, assigned_by, assigned_at, status, notes
// We consider a row "active" when status = 'active'.
//
// `configured: false` is returned only when Supabase is unavailable or the
// query throws unexpectedly — never as a silent fallback that would leak
// unrelated ideas to the evaluator.
import { createClient } from '@/lib/supabase/server';

export type EvaluatorTrackResult = { configured: boolean; themeIds: string[] };

export async function getEvaluatorTrackThemeIds(
  evaluatorId: string
): Promise<EvaluatorTrackResult> {
  if (!evaluatorId) return { configured: false, themeIds: [] };

  const supabase = await createClient();
  if (!supabase) return { configured: false, themeIds: [] };

  try {
    const { data, error } = await supabase
      .schema('innovation')
      .from('track_assignments')
      .select('theme_id')
      .eq('evaluator_id', evaluatorId)
      .eq('status', 'active');

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[getEvaluatorTrackThemeIds] query error:', error);
      return { configured: false, themeIds: [] };
    }

    const seen = new Set<string>();
    for (const row of (data as Array<{ theme_id: string | null }> | null) ?? []) {
      if (row.theme_id) seen.add(row.theme_id);
    }
    return { configured: true, themeIds: Array.from(seen) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getEvaluatorTrackThemeIds] threw:', err);
    return { configured: false, themeIds: [] };
  }
}
