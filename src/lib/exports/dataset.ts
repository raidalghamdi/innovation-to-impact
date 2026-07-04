// Data-gathering layer for exports. Reuses the app's data-access helpers so an
// export sees exactly what the UI sees (real Supabase rows when configured,
// demo fallback otherwise). Isolated here so xlsx/pdf/docx generators stay
// focused on rendering, not querying.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  fetchIdeas,
  fetchThemes,
  fetchUsers,
  fetchEvaluationSummaries,
  type EvaluationSummary,
} from '@/lib/data';
import { pick } from '@/lib/i18n-content';
import type { Idea, StrategicTheme, UserProfile } from '@/lib/demo-data';

export type ExportFilters = {
  status?: string;
  themeId?: string;
  from?: string;
  to?: string;
  ideaIds?: string[];
};

export type CommitteeDecisionRow = {
  id: string;
  idea_id: string;
  committee_name: string | null;
  decision: string;
  quorum_met: boolean;
  comments: string | null;
  decided_at: string;
  decided_by: string | null;
};

export type IdeasDataset = {
  ideas: Idea[];
  themeById: Map<string, StrategicTheme>;
  userById: Map<string, UserProfile>;
  evaluations: Record<string, EvaluationSummary>;
  decisions: CommitteeDecisionRow[];
};

// Resolve a theme's display name across the two column conventions in play:
// demo rows use name_ar/name_en, the live strategic_themes table uses
// title_ar/title_en. This keeps exports correct regardless of source.
export function themeName(theme: StrategicTheme | undefined, locale: string): string {
  if (!theme) return '';
  const r = theme as unknown as Record<string, string | undefined>;
  const ar = r.name_ar ?? r.title_ar ?? '';
  const en = r.name_en ?? r.title_en ?? '';
  return pick(ar, en, locale) || en || ar;
}

export function userName(user: UserProfile | undefined): string {
  if (!user) return '';
  const r = user as unknown as Record<string, string | undefined>;
  return r.full_name || r.full_name_ar || r.email || '';
}

async function fetchCommitteeDecisions(ideaIds: string[]): Promise<CommitteeDecisionRow[]> {
  if (!ideaIds.length || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('committee_decisions')
    .select('id, idea_id, committee_name, decision, quorum_met, comments, decided_at, decided_by')
    .in('idea_id', ideaIds)
    .order('decided_at', { ascending: false });
  return (data as CommitteeDecisionRow[] | null) ?? [];
}

function matchesFilters(idea: Idea, f: ExportFilters): boolean {
  if (f.ideaIds && f.ideaIds.length && !f.ideaIds.includes(idea.id)) return false;
  if (f.status && idea.status !== f.status) return false;
  if (f.themeId && idea.strategic_theme_id !== f.themeId) return false;
  const created = idea.created_at?.slice(0, 10);
  if (f.from && created && created < f.from) return false;
  if (f.to && created && created > f.to) return false;
  return true;
}

export async function gatherIdeasDataset(filters: ExportFilters = {}): Promise<IdeasDataset> {
  const [allIdeas, themes, users] = await Promise.all([
    fetchIdeas(),
    fetchThemes(),
    fetchUsers(),
  ]);

  const ideas = allIdeas.filter((i) => matchesFilters(i, filters));
  const ideaIds = ideas.map((i) => i.id);

  const [evaluations, decisions] = await Promise.all([
    fetchEvaluationSummaries(ideaIds),
    fetchCommitteeDecisions(ideaIds),
  ]);

  const themeById = new Map(themes.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return { ideas, themeById, userById, evaluations, decisions };
}
