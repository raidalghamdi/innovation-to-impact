// Analytics data access — reads the aggregate views created in migration 00006.
// Every helper is best-effort and returns safe defaults when Supabase is
// unavailable so the admin dashboard still renders.
//
// Errors from Supabase (RLS denials, missing view, PostgREST config, network)
// are logged to stderr so they show up in Vercel logs instead of silently
// producing empty dashboards.
import { createClient } from '@/lib/supabase/server';

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
