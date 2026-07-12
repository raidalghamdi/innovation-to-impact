// Data layer for the admin Reports Center rich charts (/admin/reports-center).
//
// One entry point — getReportChartsData() — fetches the raw rows it needs from
// the `innovation` schema in parallel (Promise.all) and computes all eight
// chart datasets in memory. Every query is best-effort: on a missing table,
// RLS denial, or unconfigured Supabase it degrades to empty datasets so the
// page still renders (each chart shows its own empty state).
//
// Separately, getReportTitles() loads the editable bilingual titles that back
// the hero card and every chart heading (see sql_pending/04_report_titles.sql).
import { createClient } from '@/lib/supabase/server';

// --- Status vocabulary (mirrors idea_status enum in 00001_initial_schema) ----
// Statuses that mean an idea has cleared the committee/approval gate. Used by
// the funnel (chart C) and the top-innovators tally (chart G).
const APPROVED_SET = new Set([
  'approved',
  'assigned',
  'in_pilot',
  'in_implementation',
  'benefits_tracking',
  'closed',
]);
const COMMITTEE_SET = new Set(['committee', ...APPROVED_SET]);
const EVALUATED_SET = new Set(['evaluation', ...COMMITTEE_SET]);
const SCREENED_SET = new Set(['screening', 'needs_completion', ...EVALUATED_SET]);

// Fixed status order so the donut/legend is stable regardless of data.
const STATUS_ORDER = [
  'draft',
  'submitted',
  'screening',
  'needs_completion',
  'evaluation',
  'committee',
  'approved',
  'rejected',
  'returned',
  'assigned',
  'in_pilot',
  'in_implementation',
  'benefits_tracking',
  'closed',
  'archived',
] as const;

export type StatusSlice = { status: string; count: number };
export type MonthPoint = { month: string; count: number };
export type FunnelStep = { key: string; count: number };
export type ThemeCount = { theme_id: string; name_ar: string | null; name_en: string | null; count: number };
export type ScoreBucket = { bucket: number; count: number };
export type StageDuration = { stage: number; avg_days: number };
export type InnovatorCount = { id: string; name_ar: string | null; name_en: string | null; count: number };
export type CommitteeMonth = { month: string; approve: number; reject: number };

export type ReportChartsData = {
  ideasByStatus: StatusSlice[];
  submissionsTimeline: MonthPoint[];
  approvalFunnel: FunnelStep[];
  ideasByTheme: ThemeCount[];
  scoreDistribution: ScoreBucket[];
  timeToDecision: StageDuration[];
  topInnovators: InnovatorCount[];
  committeeTrend: CommitteeMonth[];
};

const EMPTY: ReportChartsData = {
  ideasByStatus: [],
  submissionsTimeline: [],
  approvalFunnel: [],
  ideasByTheme: [],
  scoreDistribution: [],
  timeToDecision: [],
  topInnovators: [],
  committeeTrend: [],
};

type IdeaRow = {
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  current_stage: number | null;
  submitter_id: string | null;
  strategic_theme_id: string | null;
};
type EvalRow = { total_score: number | null };
type CommitteeRow = { decision: string | null; decided_at: string | null };
type ThemeRow = { id: string; name_ar: string | null; name_en: string | null };
type ProfileRow = { id: string; full_name: string | null; full_name_ar: string | null; email: string | null };

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 7); // YYYY-MM
}

export async function getReportChartsData(): Promise<ReportChartsData> {
  const supabase = await createClient();
  if (!supabase) return EMPTY;

  try {
    const [ideasRes, evalsRes, committeeRes, themesRes, profilesRes] = await Promise.all([
      supabase
        .from('ideas')
        .select('status, created_at, updated_at, current_stage, submitter_id, strategic_theme_id'),
      supabase.from('evaluations').select('total_score'),
      supabase.from('committee_decisions').select('decision, decided_at'),
      supabase.from('strategic_themes').select('id, name_ar, name_en'),
      supabase.from('user_profiles').select('id, full_name, full_name_ar, email'),
    ]);

    const ideas = (ideasRes.data as IdeaRow[] | null) ?? [];
    const evals = (evalsRes.data as EvalRow[] | null) ?? [];
    const committee = (committeeRes.data as CommitteeRow[] | null) ?? [];
    const themes = (themesRes.data as ThemeRow[] | null) ?? [];
    const profiles = (profilesRes.data as ProfileRow[] | null) ?? [];

    return {
      ideasByStatus: computeIdeasByStatus(ideas),
      submissionsTimeline: computeSubmissionsTimeline(ideas),
      approvalFunnel: computeFunnel(ideas),
      ideasByTheme: computeIdeasByTheme(ideas, themes),
      scoreDistribution: computeScoreDistribution(evals),
      timeToDecision: computeTimeToDecision(ideas),
      topInnovators: computeTopInnovators(ideas, profiles),
      committeeTrend: computeCommitteeTrend(committee),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getReportChartsData] threw:', err);
    return EMPTY;
  }
}

// A. Ideas by Status ---------------------------------------------------------
function computeIdeasByStatus(ideas: IdeaRow[]): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const i of ideas) {
    const s = i.status ?? 'draft';
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return STATUS_ORDER.filter((s) => counts.has(s)).map((s) => ({
    status: s,
    count: counts.get(s) ?? 0,
  }));
}

// B. Submissions over time (monthly) -----------------------------------------
function computeSubmissionsTimeline(ideas: IdeaRow[]): MonthPoint[] {
  const counts = new Map<string, number>();
  for (const i of ideas) {
    const m = monthKey(i.created_at);
    if (!m) continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.keys()].sort().map((m) => ({ month: m, count: counts.get(m) ?? 0 }));
}

// C. Approval funnel ---------------------------------------------------------
function computeFunnel(ideas: IdeaRow[]): FunnelStep[] {
  let submitted = 0;
  let screened = 0;
  let evaluated = 0;
  let committee = 0;
  let approved = 0;
  for (const i of ideas) {
    const s = i.status ?? 'draft';
    if (s !== 'draft') submitted += 1;
    if (SCREENED_SET.has(s)) screened += 1;
    if (EVALUATED_SET.has(s)) evaluated += 1;
    if (COMMITTEE_SET.has(s)) committee += 1;
    if (APPROVED_SET.has(s)) approved += 1;
  }
  return [
    { key: 'submitted', count: submitted },
    { key: 'screened', count: screened },
    { key: 'evaluated', count: evaluated },
    { key: 'committee', count: committee },
    { key: 'approved', count: approved },
  ];
}

// D. Ideas by strategic theme ------------------------------------------------
function computeIdeasByTheme(ideas: IdeaRow[], themes: ThemeRow[]): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const i of ideas) {
    if (!i.strategic_theme_id) continue;
    counts.set(i.strategic_theme_id, (counts.get(i.strategic_theme_id) ?? 0) + 1);
  }
  return themes
    .map((t) => ({ theme_id: t.id, name_ar: t.name_ar, name_en: t.name_en, count: counts.get(t.id) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

// E. Evaluation score distribution (buckets 0..10) ---------------------------
function computeScoreDistribution(evals: EvalRow[]): ScoreBucket[] {
  const scores = evals
    .map((e) => (e.total_score == null ? null : Number(e.total_score)))
    .filter((n): n is number => n != null && Number.isFinite(n));
  const buckets: ScoreBucket[] = Array.from({ length: 11 }, (_, b) => ({ bucket: b, count: 0 }));
  if (scores.length === 0) return buckets;
  // Normalise a 0..100 scale down to 0..10 when totals clearly exceed 10.
  const max = Math.max(...scores);
  const divisor = max > 10 ? max / 10 : 1;
  for (const s of scores) {
    const b = Math.min(10, Math.max(0, Math.round(s / divisor)));
    buckets[b].count += 1;
  }
  return buckets;
}

// F. Time-to-decision — avg days per stage (1..8) ----------------------------
// Approximates per-stage duration as (updated_at - created_at) / current_stage
// spread over each stage the idea has passed. Mirrors the analytics surface.
function computeTimeToDecision(ideas: IdeaRow[]): StageDuration[] {
  const sums = new Array(9).fill(0);
  const cnts = new Array(9).fill(0);
  for (const i of ideas) {
    const stage = Number(i.current_stage ?? 0);
    if (stage <= 0 || !i.created_at) continue;
    const start = Date.parse(i.created_at);
    const end = Date.parse(i.updated_at ?? i.created_at);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    const perStage = (end - start) / (1000 * 60 * 60 * 24) / stage;
    for (let s = 1; s <= stage && s <= 8; s++) {
      sums[s] += perStage;
      cnts[s] += 1;
    }
  }
  return Array.from({ length: 8 }, (_, idx) => {
    const stage = idx + 1;
    return {
      stage,
      avg_days: cnts[stage] > 0 ? Number((sums[stage] / cnts[stage]).toFixed(1)) : 0,
    };
  });
}

// G. Top innovators — top 10 submitters by approved count --------------------
function computeTopInnovators(ideas: IdeaRow[], profiles: ProfileRow[]): InnovatorCount[] {
  const counts = new Map<string, number>();
  for (const i of ideas) {
    if (!i.submitter_id) continue;
    if (!APPROVED_SET.has(i.status ?? '')) continue;
    counts.set(i.submitter_id, (counts.get(i.submitter_id) ?? 0) + 1);
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return [...counts.entries()]
    .map(([id, count]) => {
      const p = byId.get(id);
      return {
        id,
        name_ar: p?.full_name_ar ?? null,
        name_en: p?.full_name ?? p?.email ?? null,
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// H. Committee decisions trend (monthly, approve vs reject) ------------------
function computeCommitteeTrend(rows: CommitteeRow[]): CommitteeMonth[] {
  const map = new Map<string, { approve: number; reject: number }>();
  for (const r of rows) {
    const m = monthKey(r.decided_at);
    if (!m) continue;
    const entry = map.get(m) ?? { approve: 0, reject: 0 };
    if (r.decision === 'approve') entry.approve += 1;
    else if (r.decision === 'reject') entry.reject += 1;
    map.set(m, entry);
  }
  return [...map.keys()]
    .sort()
    .map((m) => ({ month: m, approve: map.get(m)!.approve, reject: map.get(m)!.reject }));
}

// --- Editable titles --------------------------------------------------------
// Types + defaults + the locale picker live in the client-safe module so client
// components can reuse them without importing this server-only file.
import { TITLE_DEFAULTS, pickTitle, type ReportTitle } from '@/lib/report-titles';

export { TITLE_DEFAULTS, pickTitle };
export type { ReportTitle };

export async function getReportTitles(): Promise<Record<string, ReportTitle>> {
  const merged: Record<string, ReportTitle> = { ...TITLE_DEFAULTS };
  const supabase = await createClient();
  if (!supabase) return merged;
  try {
    const { data, error } = await supabase
      .from('report_titles')
      .select('key, title_ar, title_en, subtitle_ar, subtitle_en');
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[getReportTitles] supabase error:', error);
      return merged;
    }
    for (const row of (data as ReportTitle[] | null) ?? []) {
      merged[row.key] = { ...merged[row.key], ...row };
    }
    return merged;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getReportTitles] threw:', err);
    return merged;
  }
}
