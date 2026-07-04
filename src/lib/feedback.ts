// Reviewer feedback visibility (Session 5).
//
// Feedback flows to submitters from two sources:
//   1. evaluations           \u2014 reviewer role = 'evaluator'
//   2. committee_decisions   \u2014 reviewer role = 'judge'
//
// The submitter sees the ROLE of the reviewer (Evaluator / Judge) plus their
// comments, rating (if any), and date \u2014 NEVER the reviewer's name or id.
// This preserves anonymity of the review while giving submitters context on
// who wrote the feedback.
import { createClient } from '@/lib/supabase/server';

export type ReviewerRole = 'evaluator' | 'judge';

export type ReviewerFeedback = {
  id: string;
  source: 'evaluation' | 'committee';
  reviewer_role: ReviewerRole;
  comments: string | null;
  rating: number | null; // 0..5 (normalised) or null
  recommendation: string | null;
  date: string; // ISO
};

function logSupabaseError(fn: string, error: unknown) {
  if (!error) return;
  // eslint-disable-next-line no-console
  console.error(`[${fn}] supabase error:`, error);
}

function logThrown(fn: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[${fn}] threw:`, err);
}

// Normalise total_score (0..100 in scorecard math) into a 0..5 star rating so
// the UI can render a consistent scale for both evaluations and committee
// decisions. Committee decisions have no numeric score, so rating is null.
function normaliseRating(totalScore: number | null | undefined): number | null {
  if (totalScore == null) return null;
  const n = Number(totalScore);
  if (Number.isNaN(n)) return null;
  // Heuristic: scorecard totals are typically 0..100 or 0..5. Detect scale.
  const scale = n > 5 ? 100 : 5;
  const stars = (n / scale) * 5;
  return Math.max(0, Math.min(5, Number(stars.toFixed(1))));
}

export async function getFeedbackForIdea(ideaId: string): Promise<ReviewerFeedback[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const out: ReviewerFeedback[] = [];
  try {
    const { data: evals, error: ee } = await supabase
      .from('evaluations')
      .select('id, comments, total_score, recommendation, submitted_at')
      .eq('idea_id', ideaId)
      .order('submitted_at', { ascending: false });
    logSupabaseError('getFeedbackForIdea:evaluations', ee);
    if (evals) {
      for (const row of evals as {
        id: string;
        comments: string | null;
        total_score: number | null;
        recommendation: string | null;
        submitted_at: string;
      }[]) {
        if (!row.comments || !row.comments.trim()) continue;
        out.push({
          id: `eval:${row.id}`,
          source: 'evaluation',
          reviewer_role: 'evaluator',
          comments: row.comments,
          rating: normaliseRating(row.total_score),
          recommendation: row.recommendation,
          date: row.submitted_at,
        });
      }
    }
  } catch (err) {
    logThrown('getFeedbackForIdea:evaluations', err);
  }

  try {
    const { data: decisions, error: de } = await supabase
      .from('committee_decisions')
      .select('id, comments, decision, decided_at')
      .eq('idea_id', ideaId)
      .order('decided_at', { ascending: false });
    logSupabaseError('getFeedbackForIdea:committee', de);
    if (decisions) {
      for (const row of decisions as {
        id: string;
        comments: string | null;
        decision: string | null;
        decided_at: string;
      }[]) {
        if (!row.comments || !row.comments.trim()) continue;
        out.push({
          id: `cmt:${row.id}`,
          source: 'committee',
          reviewer_role: 'judge',
          comments: row.comments,
          rating: null,
          recommendation: row.decision,
          date: row.decided_at,
        });
      }
    }
  } catch (err) {
    logThrown('getFeedbackForIdea:committee', err);
  }

  // Newest first
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

// Feedback counts for every idea a submitter owns. Returns a map keyed by
// idea_id -> count. Used to render badges on /my-ideas without one query per
// idea. Only counts rows with non-empty comments.
export async function getFeedbackCountsForSubmitter(
  submitterId: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  if (!supabase) return {};
  const counts: Record<string, number> = {};
  try {
    const { data: mine, error: me } = await supabase
      .from('ideas')
      .select('id')
      .eq('submitter_id', submitterId);
    logSupabaseError('getFeedbackCountsForSubmitter:ideas', me);
    if (!mine || mine.length === 0) return {};
    const ids = (mine as { id: string }[]).map((r) => r.id);

    const { data: evals, error: ee } = await supabase
      .from('evaluations')
      .select('idea_id, comments')
      .in('idea_id', ids);
    logSupabaseError('getFeedbackCountsForSubmitter:evaluations', ee);
    if (evals) {
      for (const row of evals as { idea_id: string; comments: string | null }[]) {
        if (!row.comments || !row.comments.trim()) continue;
        counts[row.idea_id] = (counts[row.idea_id] ?? 0) + 1;
      }
    }

    const { data: decisions, error: de } = await supabase
      .from('committee_decisions')
      .select('idea_id, comments')
      .in('idea_id', ids);
    logSupabaseError('getFeedbackCountsForSubmitter:committee', de);
    if (decisions) {
      for (const row of decisions as { idea_id: string; comments: string | null }[]) {
        if (!row.comments || !row.comments.trim()) continue;
        counts[row.idea_id] = (counts[row.idea_id] ?? 0) + 1;
      }
    }
  } catch (err) {
    logThrown('getFeedbackCountsForSubmitter', err);
  }
  return counts;
}
