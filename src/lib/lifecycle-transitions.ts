// R43 lifecycle transitions (Agent B). Thin TypeScript wrappers around the
// SQL state-machine functions in supabase/migrations/00036_lifecycle_functions.
// Every wrapper is defensive: a transition failure must NEVER lose the
// underlying evaluator/committee submission, so callers wrap these in a
// best-effort try/catch and these functions also swallow their own errors.
import { createClient } from '@/lib/supabase/server';
import { getTopN } from '@/lib/admin-settings';

// T1 — invoked after an evaluator submits. When the last assigned evaluator's
// scorecard lands, the RPC computes the average and transitions the idea to
// pass_awaiting_attachments or evaluation_failed. Returns the new status, or
// null when nothing changed (not all evaluators in yet, or a lost race).
export async function afterEvaluatorSubmit(
  ideaId: string
): Promise<{ newStatus: string | null }> {
  try {
    const supabase = await createClient();
    if (!supabase) return { newStatus: null };
    const { data, error } = await supabase.rpc('check_evaluation_complete', {
      p_idea_id: ideaId,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[afterEvaluatorSubmit] rpc error:', error.message);
      return { newStatus: null };
    }
    return { newStatus: (data as string | null) ?? null };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[afterEvaluatorSubmit] threw:', err);
    return { newStatus: null };
  }
}

// T3 — invoked after a committee member records a decision. When the last
// member has decided, the RPC computes the committee score and transitions the
// idea to pending_final_ranking. Returns the new status or null (no-op).
export async function afterCommitteeSubmit(
  ideaId: string
): Promise<{ newStatus: string | null }> {
  try {
    const supabase = await createClient();
    if (!supabase) return { newStatus: null };
    const { data, error } = await supabase.rpc('check_committee_complete', {
      p_idea_id: ideaId,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[afterCommitteeSubmit] rpc error:', error.message);
      return { newStatus: null };
    }
    return { newStatus: (data as string | null) ?? null };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[afterCommitteeSubmit] threw:', err);
    return { newStatus: null };
  }
}

// T4 — admin-triggered final ranking. Ranks all pending_final_ranking ideas per
// track; top N approved, rest not_selected. Returns the resulting counts.
export async function runFinalRanking(): Promise<{
  approved: number;
  notSelected: number;
  topN: number;
}> {
  const supabase = await createClient();
  if (!supabase) return { approved: 0, notSelected: 0, topN: 0 };
  const { data, error } = await supabase.rpc('run_final_ranking');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[runFinalRanking] rpc error:', error.message);
    throw new Error(error.message);
  }
  // The function returns a single-row table.
  const row = Array.isArray(data) ? data[0] : data;
  const r = (row ?? {}) as {
    approved_count?: number;
    not_selected_count?: number;
    top_n?: number;
  };
  return {
    approved: Number(r.approved_count ?? 0),
    notSelected: Number(r.not_selected_count ?? 0),
    topN: Number(r.top_n ?? 0),
  };
}

export type RankingPreviewIdea = {
  id: string;
  code: string | null;
  title_en: string | null;
  title_ar: string | null;
  strategic_theme_id: string | null;
  committee_final_score: number | null;
  rank: number;
};

// Read-only dry run mirroring the SQL ordering. Splits each track's ranked
// ideas at Top-N so the admin can preview the outcome before applying. Mutates
// nothing.
export async function previewFinalRanking(): Promise<{
  wouldApprove: RankingPreviewIdea[];
  wouldNotSelect: RankingPreviewIdea[];
  topN: number;
}> {
  const supabase = await createClient();
  if (!supabase) return { wouldApprove: [], wouldNotSelect: [], topN: 0 };

  const topN = await getTopN();

  const { data, error } = await supabase
    .from('ideas')
    .select('id, code, title_en, title_ar, strategic_theme_id, committee_final_score, created_at')
    .eq('status', 'pending_final_ranking');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[previewFinalRanking] query error:', error.message);
    throw new Error(error.message);
  }

  type Row = {
    id: string;
    code: string | null;
    title_en: string | null;
    title_ar: string | null;
    strategic_theme_id: string | null;
    committee_final_score: number | null;
    created_at: string | null;
  };
  const rows = ((data as Row[] | null) ?? []).slice();

  // Group by track, then order by score desc (nulls last) then created_at asc,
  // matching run_final_ranking()'s window ordering exactly.
  const byTrack = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.strategic_theme_id ?? '__none__';
    const list = byTrack.get(key) ?? [];
    list.push(row);
    byTrack.set(key, list);
  }

  const wouldApprove: RankingPreviewIdea[] = [];
  const wouldNotSelect: RankingPreviewIdea[] = [];

  for (const list of byTrack.values()) {
    list.sort((a, b) => {
      const sa = a.committee_final_score;
      const sb = b.committee_final_score;
      if (sa == null && sb != null) return 1;
      if (sb == null && sa != null) return -1;
      if (sa != null && sb != null && sa !== sb) return sb - sa;
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });
    list.forEach((row, idx) => {
      const rank = idx + 1;
      const entry: RankingPreviewIdea = {
        id: row.id,
        code: row.code,
        title_en: row.title_en,
        title_ar: row.title_ar,
        strategic_theme_id: row.strategic_theme_id,
        committee_final_score: row.committee_final_score,
        rank,
      };
      if (rank <= topN) wouldApprove.push(entry);
      else wouldNotSelect.push(entry);
    });
  }

  return { wouldApprove, wouldNotSelect, topN };
}
