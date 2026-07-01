// AI-similarity helper backed by the `find_similar_ideas` RPC (pg_trgm).
import { createClient } from '@/lib/supabase/server';

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
