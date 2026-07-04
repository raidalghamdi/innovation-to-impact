// AI-similarity helper backed by the `find_similar_ideas` RPC (pg_trgm).
import { createClient } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';

export type SimilarIdea = {
  id: string;
  code: string;
  title_ar: string | null;
  title_en: string | null;
  status: string | null;
  similarity: number;
};

const DEFAULT_THRESHOLD = 0.2;
const DEFAULT_MAX = 5;

// Server-side similarity lookup (used by the idea detail page). The client-side
// idea form calls the RPC directly against the browser client so it can debounce
// as the user types.
export async function findSimilarIdeas(
  text: string,
  excludeId: string | null = null,
  threshold = DEFAULT_THRESHOLD,
  maxResults = DEFAULT_MAX
): Promise<SimilarIdea[]> {
  if (!text || text.trim().length < 3) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase.rpc('find_similar_ideas', {
      query_text: text,
      exclude_id: excludeId,
      similarity_threshold: threshold,
      max_results: maxResults,
    });
    return (data as SimilarIdea[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection (WS7 F3). A two-pass Jaccard: a cheap title-token pass
// over the most recent ideas, then a deeper title+description pass only for the
// rows that clear a low threshold. Runs entirely in JS so it works against the
// demo dataset when Supabase is offline.
// ---------------------------------------------------------------------------

export type DuplicateCandidate = {
  ideaId: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  score: number;
  matched_field: 'title' | 'description';
};

export type DuplicateInput = {
  title_ar?: string | null;
  title_en?: string | null;
  description?: string | null;
  excludeId?: string | null;
};

type IdeaRow = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
};

const RECENT_LIMIT = 500;
const THRESHOLD_LOW = 0.3;
const DEFAULT_MAX_DUP = 5;

// Unicode-aware tokenizer: keeps Arabic + Latin word characters, lowercases,
// drops tokens shorter than 2 chars.
function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const matches = text
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  const out = new Set<string>();
  for (const tok of matches ?? []) {
    if (tok.length >= 2) out.add(tok);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function fetchRecentIdeas(): Promise<IdeaRow[]> {
  const supabase = await createClient();
  if (!supabase) {
    return (demo.ideas as unknown as IdeaRow[]).slice(0, RECENT_LIMIT);
  }
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, code, title_ar, title_en, problem_statement, proposed_solution')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT);
    if (error || !data || data.length === 0) {
      return (demo.ideas as unknown as IdeaRow[]).slice(0, RECENT_LIMIT);
    }
    return data as IdeaRow[];
  } catch {
    return (demo.ideas as unknown as IdeaRow[]).slice(0, RECENT_LIMIT);
  }
}

export async function findDuplicates(
  candidate: DuplicateInput,
  opts: { threshold?: number; maxResults?: number } = {}
): Promise<DuplicateCandidate[]> {
  const threshold = opts.threshold ?? THRESHOLD_LOW;
  const maxResults = opts.maxResults ?? DEFAULT_MAX_DUP;

  const candTitle = tokenize(`${candidate.title_ar ?? ''} ${candidate.title_en ?? ''}`);
  if (candTitle.size === 0) return [];
  const candDesc = tokenize(candidate.description);

  const rows = await fetchRecentIdeas();
  const scored: DuplicateCandidate[] = [];

  for (const row of rows) {
    if (candidate.excludeId && row.id === candidate.excludeId) continue;
    const rowTitle = tokenize(`${row.title_ar ?? ''} ${row.title_en ?? ''}`);
    const titleScore = jaccard(candTitle, rowTitle);
    if (titleScore < threshold) continue;

    // Deeper pass: fold description similarity in for rows that cleared the
    // cheap title gate. The stronger of the two signals wins the matched_field.
    let best = titleScore;
    let field: 'title' | 'description' = 'title';
    if (candDesc.size > 0) {
      const rowDesc = tokenize(`${row.problem_statement ?? ''} ${row.proposed_solution ?? ''}`);
      const descScore = jaccard(candDesc, rowDesc);
      if (descScore > best) {
        best = descScore;
        field = 'description';
      }
    }

    scored.push({
      ideaId: row.id,
      code: row.code,
      title_ar: row.title_ar,
      title_en: row.title_en,
      score: Number(best.toFixed(3)),
      matched_field: field,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
