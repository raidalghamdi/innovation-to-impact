// Client-safe demo dataset for the search page fallback when the live DB is
// unavailable. Kept minimal and independent of server-only modules.
import { ideas } from '@/lib/demo-data';

export const fallbackIdeas = ideas.map((i) => ({
  id: i.id,
  title_ar: i.title_ar,
  title_en: i.title_en,
  problem_statement: i.problem_statement,
  proposed_solution: i.proposed_solution,
  status: i.status,
  current_stage: i.current_stage,
  created_at: i.created_at,
}));
