// Analytics data access — reads the aggregate views created in migration 00006.
// Every helper is best-effort and returns safe defaults when Supabase is
// unavailable so the admin dashboard still renders.
//
// Errors from Supabase (RLS denials, missing view, PostgREST config, network)
// are logged to stderr so they show up in Vercel logs instead of silently
// producing empty dashboards.
import { createClient } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';

function logSupabaseError(fn: string, error: unknown) {
  if (!error) return;
  // eslint-disable-next-line no-console
  console.error(`[${fn}] supabase error:`, error);
}

function logThrown(fn: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[${fn}] threw:`, err);
}

export type PlatformKpis = {
  total_submissions: number;
  total_approved: number;
  total_implemented: number;
  active_submitters: number;
  total_evaluations: number;
  total_users: number;
  total_evaluators: number;
  realized_financial_impact: number;
};

export type FunnelRow = { stage: string; n: number };

export type CohortRow = {
  cohort_month: string;
  submitted: number;
  approved: number;
  rejected: number;
  implemented: number;
};

export type ThemeActivityRow = {
  theme_id: string;
  name_ar: string | null;
  name_en: string | null;
  n_ideas: number;
  n_approved: number;
};

export type TopEvaluatorRow = {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string | null;
  n_evaluations: number;
  avg_score: number | null;
};

export type LeaderboardRow = {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string | null;
  role: string | null;
  points: number;
  level: number;
  n_badges: number;
  rank: number;
};

const EMPTY_KPIS: PlatformKpis = {
  total_submissions: 0,
  total_approved: 0,
  total_implemented: 0,
  active_submitters: 0,
  total_evaluations: 0,
  total_users: 0,
  total_evaluators: 0,
  realized_financial_impact: 0,
};

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const supabase = await createClient();
  if (!supabase) return EMPTY_KPIS;
  try {
    const { data, error } = await supabase.from('v_platform_kpis').select('*').maybeSingle();
    logSupabaseError('getPlatformKpis', error);
    return { ...EMPTY_KPIS, ...(data as Partial<PlatformKpis>) };
  } catch (err) {
    logThrown('getPlatformKpis', err);
    return EMPTY_KPIS;
  }
}

export async function getFunnel(): Promise<FunnelRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_funnel').select('*');
    logSupabaseError('getFunnel', error);
    return (data as FunnelRow[]) ?? [];
  } catch (err) {
    logThrown('getFunnel', err);
    return [];
  }
}

export async function getMonthlyCohort(): Promise<CohortRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_monthly_cohort')
      .select('*')
      .order('cohort_month', { ascending: true });
    logSupabaseError('getMonthlyCohort', error);
    return (data as CohortRow[]) ?? [];
  } catch (err) {
    logThrown('getMonthlyCohort', err);
    return [];
  }
}

export async function getThemeActivity(): Promise<ThemeActivityRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_theme_activity')
      .select('*')
      .order('n_ideas', { ascending: false });
    logSupabaseError('getThemeActivity', error);
    return (data as ThemeActivityRow[]) ?? [];
  } catch (err) {
    logThrown('getThemeActivity', err);
    return [];
  }
}

export async function getTopEvaluators(): Promise<TopEvaluatorRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_top_evaluators')
      .select('*')
      .order('n_evaluations', { ascending: false });
    logSupabaseError('getTopEvaluators', error);
    return (data as TopEvaluatorRow[]) ?? [];
  } catch (err) {
    logThrown('getTopEvaluators', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Executive dashboard (Session 5) — 5 specific charts requested by GAC:
//   1. Total ideas by stage (0..8)
//   2. Ideas submitted per day over last 90 days
//   3. Top 5 strategic objectives by idea count
//   4. Average time in each stage (days)
//   5. Submitted → pilot conversion rate
// Each returns safe fallback data (demo-data or zeros) if Supabase is offline.
// ---------------------------------------------------------------------------

export type IdeasByStageRow = { stage: number; count: number };
export type SubmissionsPerDayRow = { day: string; count: number };
export type TopObjectiveRow = {
  theme_id: string;
  name_ar: string | null;
  name_en: string | null;
  count: number;
};
export type AvgTimePerStageRow = { stage: number; avg_days: number };
export type ConversionMetric = { submitted: number; pilot: number; rate: number };

// Fixed 0..8 skeleton; ensures the bar chart always renders all 9 stages
// even when no ideas have reached later stages.
const STAGE_SKELETON: IdeasByStageRow[] = Array.from({ length: 9 }, (_, i) => ({
  stage: i,
  count: 0,
}));

export async function getIdeasByStage(): Promise<IdeasByStageRow[]> {
  const supabase = await createClient();
  if (!supabase) return computeIdeasByStageFromDemo();
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('current_stage');
    logSupabaseError('getIdeasByStage', error);
    if (!data || data.length === 0) return computeIdeasByStageFromDemo();
    const counts = STAGE_SKELETON.map((s) => ({ ...s }));
    for (const row of data as { current_stage: number | null }[]) {
      const s = Number(row.current_stage ?? 0);
      if (s >= 0 && s <= 8) counts[s].count += 1;
    }
    return counts;
  } catch (err) {
    logThrown('getIdeasByStage', err);
    return computeIdeasByStageFromDemo();
  }
}

function computeIdeasByStageFromDemo(): IdeasByStageRow[] {
  const counts = STAGE_SKELETON.map((s) => ({ ...s }));
  for (const i of demo.ideas) {
    const s = Number(i.current_stage ?? 0);
    if (s >= 0 && s <= 8) counts[s].count += 1;
  }
  return counts;
}

export async function getSubmissionsPerDay(days = 90): Promise<SubmissionsPerDayRow[]> {
  const skeleton = buildDaySkeleton(days);
  const supabase = await createClient();
  if (!supabase) return fillDaysFromDemo(skeleton);
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('ideas')
      .select('created_at')
      .gte('created_at', since.toISOString());
    logSupabaseError('getSubmissionsPerDay', error);
    if (!data) return fillDaysFromDemo(skeleton);
    const map = new Map(skeleton.map((r) => [r.day, r]));
    for (const row of data as { created_at: string | null }[]) {
      if (!row.created_at) continue;
      const day = row.created_at.slice(0, 10);
      const entry = map.get(day);
      if (entry) entry.count += 1;
    }
    return skeleton;
  } catch (err) {
    logThrown('getSubmissionsPerDay', err);
    return fillDaysFromDemo(skeleton);
  }
}

function buildDaySkeleton(days: number): SubmissionsPerDayRow[] {
  const out: SubmissionsPerDayRow[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  return out;
}

function fillDaysFromDemo(skeleton: SubmissionsPerDayRow[]): SubmissionsPerDayRow[] {
  const map = new Map(skeleton.map((r) => [r.day, r]));
  for (const i of demo.ideas) {
    if (!i.created_at) continue;
    const day = String(i.created_at).slice(0, 10);
    const entry = map.get(day);
    if (entry) entry.count += 1;
  }
  return skeleton;
}

export async function getTopObjectives(limit = 5): Promise<TopObjectiveRow[]> {
  const supabase = await createClient();
  if (!supabase) return computeTopObjectivesFromDemo(limit);
  try {
    const { data: themes, error: te } = await supabase
      .from('strategic_themes')
      .select('id, name_ar, name_en');
    logSupabaseError('getTopObjectives:themes', te);
    const { data: ideas, error: ie } = await supabase
      .from('ideas')
      .select('strategic_theme_id');
    logSupabaseError('getTopObjectives:ideas', ie);
    if (!themes || !ideas || themes.length === 0) return computeTopObjectivesFromDemo(limit);
    const counts = new Map<string, number>();
    for (const row of ideas as { strategic_theme_id: string | null }[]) {
      if (!row.strategic_theme_id) continue;
      counts.set(row.strategic_theme_id, (counts.get(row.strategic_theme_id) ?? 0) + 1);
    }
    const rows: TopObjectiveRow[] = (themes as {
      id: string;
      name_ar: string | null;
      name_en: string | null;
    }[]).map((t) => ({
      theme_id: t.id,
      name_ar: t.name_ar,
      name_en: t.name_en,
      count: counts.get(t.id) ?? 0,
    }));
    rows.sort((a, b) => b.count - a.count);
    return rows.slice(0, limit);
  } catch (err) {
    logThrown('getTopObjectives', err);
    return computeTopObjectivesFromDemo(limit);
  }
}

function computeTopObjectivesFromDemo(limit: number): TopObjectiveRow[] {
  const counts = new Map<string, number>();
  for (const i of demo.ideas) {
    if (!i.strategic_theme_id) continue;
    counts.set(i.strategic_theme_id, (counts.get(i.strategic_theme_id) ?? 0) + 1);
  }
  const rows: TopObjectiveRow[] = demo.themes.map((t) => ({
    theme_id: t.id,
    name_ar: t.name_ar,
    name_en: t.name_en,
    count: counts.get(t.id) ?? 0,
  }));
  rows.sort((a, b) => b.count - a.count);
  return rows.slice(0, limit);
}

// Avg time in stage: for each idea, we approximate 'time spent in a stage' as
// (updated_at — created_at) / max(current_stage, 1). This yields an average
// per-stage duration across ideas that have advanced at least one stage. Ideas
// at stage 0 contribute 0 to every bucket. In production this can be replaced
// with a proper stage_transitions log — the shape stays the same.
export async function getAvgTimePerStage(): Promise<AvgTimePerStageRow[]> {
  const skeleton: AvgTimePerStageRow[] = Array.from({ length: 9 }, (_, i) => ({
    stage: i,
    avg_days: 0,
  }));
  const supabase = await createClient();
  const rows = supabase
    ? await (async () => {
        try {
          const { data, error } = await supabase
            .from('ideas')
            .select('current_stage, created_at, updated_at');
          logSupabaseError('getAvgTimePerStage', error);
          return data as
            | { current_stage: number | null; created_at: string; updated_at: string | null }[]
            | null;
        } catch (err) {
          logThrown('getAvgTimePerStage', err);
          return null;
        }
      })()
    : null;
  const source: {
    current_stage: number | null;
    created_at: string;
    updated_at: string | null;
  }[] =
    rows && rows.length > 0
      ? rows
      : (demo.ideas as unknown as {
          current_stage: number | null;
          created_at: string;
          updated_at: string | null;
        }[]);

  const sums: number[] = new Array(9).fill(0);
  const cnts: number[] = new Array(9).fill(0);
  for (const row of source) {
    const stage = Number(row.current_stage ?? 0);
    if (stage <= 0) continue;
    const start = Date.parse(row.created_at);
    const end = Date.parse(row.updated_at ?? row.created_at);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    const totalDays = (end - start) / (1000 * 60 * 60 * 24);
    const perStage = totalDays / stage;
    for (let s = 1; s <= stage && s <= 8; s++) {
      sums[s] += perStage;
      cnts[s] += 1;
    }
  }
  return skeleton.map((s, i) => ({
    stage: i,
    avg_days: cnts[i] > 0 ? Number((sums[i] / cnts[i]).toFixed(1)) : 0,
  }));
}

// Submitted → pilot conversion. 'Submitted' = any idea whose status is not
// 'draft'. 'Pilot' = ideas at stage ≥ 6 OR status in {in_pilot, in_implementation,
// benefits_tracking, closed}. Rate is pilot / max(submitted, 1) * 100.
export async function getSubmittedToPilotConversion(): Promise<ConversionMetric> {
  const supabase = await createClient();
  const rows = supabase
    ? await (async () => {
        try {
          const { data, error } = await supabase
            .from('ideas')
            .select('status, current_stage');
          logSupabaseError('getSubmittedToPilotConversion', error);
          return data as { status: string | null; current_stage: number | null }[] | null;
        } catch (err) {
          logThrown('getSubmittedToPilotConversion', err);
          return null;
        }
      })()
    : null;
  const source: { status: string | null; current_stage: number | null }[] =
    rows && rows.length > 0
      ? rows
      : (demo.ideas as unknown as { status: string | null; current_stage: number | null }[]);

  const PILOT_STATUSES = new Set(['in_pilot', 'in_implementation', 'benefits_tracking', 'closed']);
  let submitted = 0;
  let pilot = 0;
  for (const row of source) {
    const status = row.status ?? '';
    if (status && status !== 'draft') submitted += 1;
    const stage = Number(row.current_stage ?? 0);
    if (stage >= 6 || PILOT_STATUSES.has(status)) pilot += 1;
  }
  const rate = submitted > 0 ? Number(((pilot / submitted) * 100).toFixed(1)) : 0;
  return { submitted, pilot, rate };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_leaderboard')
      .select('*')
      .order('rank', { ascending: true });
    logSupabaseError('getLeaderboard', error);
    return (data as LeaderboardRow[]) ?? [];
  } catch (err) {
    logThrown('getLeaderboard', err);
    return [];
  }
}
