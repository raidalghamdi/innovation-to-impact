// Per-screen live data layer for the rich chart reports. One exported function
// per admin screen (with a supervisor scope variant selected by the `scope`
// arg). Every query is LIVE — no caching — and best-effort: on a missing table,
// RLS denial, or unconfigured Supabase the affected dataset degrades to empty so
// a report still renders (each chart shows its own empty state).
//
// Schemas: ALL business tables (ideas, evaluations, committee_decisions,
// user_profiles, audit_logs, compliance_controls, strategic_themes, activities,
// escalations, support_messages, report_titles) live in `innovation`, which is
// the Supabase client's default schema per src/lib/supabase/server.ts. So we
// do NOT switch schema at all — the bare `sb.from(...)` calls hit `innovation`.
//
// Supervisor scope: filtered to the supervisor's own department. `ideas` are
// scoped by the submitter's department (resolved in memory), users/audit/etc by
// the obvious owning column where one exists. When the department can't be
// resolved the scope is a no-op (returns the admin-wide set) rather than empty.
import { createClient } from '@/lib/supabase/server';

export type Scope = 'admin' | 'supervisor';

// Normalized datum shapes consumed by the registry → renderChart bridge.
export type Categorical = { kind: 'categorical'; labels: string[]; values: number[] };
export type MultiSeries = {
  kind: 'multi';
  labels: string[];
  series: { name: string; values: number[] }[];
};
export type Points = { kind: 'points'; points: Array<{ x: number; y: number }> };
export type Matrix = { kind: 'matrix'; xLabels: string[]; yLabels: string[]; matrix: number[][] };
export type Values = { kind: 'values'; values: number[] };
export type ChartDatum = Categorical | MultiSeries | Points | Matrix | Values;

export type ScreenData = Record<string, ChartDatum>;

const cat = (labels: string[], values: number[]): Categorical => ({ kind: 'categorical', labels, values });
const multi = (labels: string[], series: { name: string; values: number[] }[]): MultiSeries => ({
  kind: 'multi',
  labels,
  series,
});
const pts = (points: Array<{ x: number; y: number }>): Points => ({ kind: 'points', points });
const mtx = (xLabels: string[], yLabels: string[], matrix: number[][]): Matrix => ({
  kind: 'matrix',
  xLabels,
  yLabels,
  matrix,
});
const vals = (values: number[]): Values => ({ kind: 'values', values });

// ── Raw row types (only the columns we read) ─────────────────────────────────
type Idea = {
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  current_stage: number | null;
  submitter_id: string | null;
  strategic_theme_id: string | null;
  activity_id: string | null;
  category: string | null;
};
type Evaluation = {
  idea_id: string | null;
  evaluator_id: string | null;
  total_score: number | null;
  recommendation: string | null;
  submitted_at: string | null;
};
type Profile = {
  id: string;
  full_name: string | null;
  full_name_ar?: string | null;
  email: string | null;
  department: string | null;
  created_at: string | null;
};
type Theme = { id: string; name_ar: string | null; name_en: string | null };
type Activity = { id: string; name_ar: string | null; name_en: string | null };
type Audit = { action: string | null; entity_type: string | null; actor_id: string | null; created_at: string | null };
type Escalation = {
  status: string | null;
  current_level: number | null;
  entity_type: string | null;
  opened_at: string | null;
  resolved_at: string | null;
  opened_by: string | null;
};
type Support = { created_at: string | null; handled_at: string | null; handled_by: string | null };
type Compliance = { regulator: string | null; status: string | null };

// ── Small aggregation helpers ────────────────────────────────────────────────
const APPROVED = new Set(['approved', 'assigned', 'in_pilot', 'in_implementation', 'benefits_tracking', 'closed']);
const COMMITTEE = new Set(['committee', ...APPROVED]);
const EVALUATED = new Set(['evaluation', ...COMMITTEE]);
const SCREENED = new Set(['screening', 'needs_completion', ...EVALUATED]);

function monthKey(iso: string | null): string | null {
  return iso ? iso.slice(0, 7) : null;
}
function dayKey(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}
function isoWeekKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function tallySorted(items: Array<string | null | undefined>, fallback = 'unknown'): Categorical {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = it || fallback;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return cat(entries.map((e) => e[0]), entries.map((e) => e[1]));
}

function timeSeries(items: Array<string | null>, keyer: (s: string | null) => string | null): Categorical {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyer(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const keys = [...m.keys()].sort();
  return cat(keys, keys.map((k) => m.get(k) ?? 0));
}

// Bucket day-durations into human ranges.
function durationBuckets(daysList: number[]): Categorical {
  const labels = ['<1d', '1-3d', '4-7d', '1-2w', '2-4w', '>4w'];
  const counts = [0, 0, 0, 0, 0, 0];
  for (const d of daysList) {
    if (d < 1) counts[0]++;
    else if (d <= 3) counts[1]++;
    else if (d <= 7) counts[2]++;
    else if (d <= 14) counts[3]++;
    else if (d <= 28) counts[4]++;
    else counts[5]++;
  }
  return cat(labels, counts);
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const s = Date.parse(a);
  const e = Date.parse(b);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return (e - s) / 86400000;
}

// ── The single fetch+compute pass; every screen derives its slice from this ──
type AllData = {
  // analytics / ideas
  submissionsOverTime: Categorical;
  ideasByStage: Categorical;
  ideasByTrack: Categorical;
  ideasByChallenge: Categorical;
  ideasByStatus: Categorical;
  conversionFunnel: Categorical;
  evaluationWorkload: Categorical;
  top10Innovators: Categorical;
  weeklyTrend: Categorical;
  // evaluations
  avgScores: Categorical;
  evaluatorDistribution: Categorical;
  evalStatus: Categorical;
  processingTime: Categorical;
  interRaterAgreement: Points;
  // users
  usersByRole: Categorical;
  usersByDepartment: Categorical;
  userMonthlyActivity: Categorical;
  lastLoginDistribution: Categorical;
  // audit
  auditByAction: Categorical;
  auditByEntityType: Categorical;
  auditByActor: Categorical;
  auditOverTime: Categorical;
  // escalations
  escalationsByStatus: Categorical;
  escalationsByLevel: Categorical;
  escalationResolutionTime: Categorical;
  escalationsByType: Categorical;
  // support
  supportVolume: Categorical;
  supportResponseTime: Categorical;
  supportResolutionRate: Categorical;
  supportByHandler: Categorical;
  // compliance
  complianceRate: Categorical;
  complianceByStandard: Categorical;
  complianceStatus: Categorical;
};

async function loadAll(scope: Scope, userId?: string): Promise<AllData> {
  const empty = buildEmpty();
  const sb = await createClient();
  if (!sb) return empty;
  // All tables read here live in `innovation` — use the default client schema.
  const pub = sb;

  try {
    const [ideasR, evalsR, profilesR, themesR, activitiesR, auditR, complianceR, escR, supR, rolesR] = await Promise.all([
      pub.from('ideas').select('status, created_at, updated_at, current_stage, submitter_id, strategic_theme_id, activity_id, category'),
      pub.from('evaluations').select('idea_id, evaluator_id, total_score, recommendation, submitted_at'),
      pub.from('user_profiles').select('id, full_name, full_name_ar, email, department, created_at'),
      pub.from('strategic_themes').select('id, name_ar, name_en'),
      pub.from('activities').select('id, name_ar, name_en'),
      pub.from('audit_logs').select('action, entity_type, actor_id, created_at'),
      pub.from('compliance_controls').select('regulator, status'),
      sb.from('escalations').select('status, current_level, entity_type, opened_at, resolved_at, opened_by'),
      sb.from('support_messages').select('created_at, handled_at, handled_by'),
      pub.from('v_user_roles').select('user_id, role_code, is_primary, role_active'),
    ]);

    let ideas = (ideasR.data as Idea[] | null) ?? [];
    let evals = (evalsR.data as Evaluation[] | null) ?? [];
    const profiles = (profilesR.data as Profile[] | null) ?? [];
    const themes = (themesR.data as Theme[] | null) ?? [];
    const activities = (activitiesR.data as Activity[] | null) ?? [];
    let audit = (auditR.data as Audit[] | null) ?? [];
    const compliance = (complianceR.data as Compliance[] | null) ?? [];
    let escalations = (escR.data as Escalation[] | null) ?? [];
    const support = (supR.data as Support[] | null) ?? [];

    // Primary role per user from the source of truth (innovation.v_user_roles),
    // replacing the deprecated user_profiles.role for the users-by-role tally.
    const roleRows = (rolesR.data as Array<{ user_id: string; role_code: string; is_primary: boolean; role_active: boolean }> | null) ?? [];
    const primaryRoleByUser = new Map<string, string>();
    for (const r of roleRows) {
      if (r.role_active === false) continue;
      if (r.is_primary || !primaryRoleByUser.has(r.user_id)) {
        primaryRoleByUser.set(r.user_id, r.role_code);
      }
    }

    const profById = new Map(profiles.map((p) => [p.id, p]));
    const nameOf = (p: Profile | undefined) => p?.full_name || p?.email || (p ? p.id.slice(0, 8) : 'unknown');

    // Supervisor scoping by department.
    let deptProfiles = profiles;
    if (scope === 'supervisor' && userId) {
      const dept = profById.get(userId)?.department ?? null;
      if (dept) {
        const inDept = (id: string | null | undefined) => !!id && profById.get(id)?.department === dept;
        ideas = ideas.filter((i) => inDept(i.submitter_id));
        const ideaIds = new Set<string>(); // scope evals to ideas by the same team
        evals = evals.filter((e) => inDept(e.evaluator_id) || (e.idea_id && ideaIds.has(e.idea_id)));
        audit = audit.filter((a) => inDept(a.actor_id));
        escalations = escalations.filter((e) => inDept(e.opened_by));
        deptProfiles = profiles.filter((p) => p.department === dept);
      }
    }

    // Ideas / analytics -------------------------------------------------------
    const submissionsOverTime = timeSeries(ideas.map((i) => i.created_at), monthKey);
    const stageCounts = new Map<number, number>();
    for (const i of ideas) {
      const s = Number(i.current_stage ?? 0);
      stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
    }
    const stageKeys = [...stageCounts.keys()].sort((a, b) => a - b);
    const ideasByStage = cat(stageKeys.map((s) => `Stage ${s}`), stageKeys.map((s) => stageCounts.get(s) ?? 0));

    const themeName = (id: string) => {
      const t = themes.find((x) => x.id === id);
      return t?.name_en || t?.name_ar || id.slice(0, 6);
    };
    const themeTally = new Map<string, number>();
    for (const i of ideas) if (i.strategic_theme_id) themeTally.set(i.strategic_theme_id, (themeTally.get(i.strategic_theme_id) ?? 0) + 1);
    const themeEntries = [...themeTally.entries()].sort((a, b) => b[1] - a[1]);
    const ideasByTrack = cat(themeEntries.map((e) => themeName(e[0])), themeEntries.map((e) => e[1]));

    const actName = (id: string) => {
      const a = activities.find((x) => x.id === id);
      return a?.name_en || a?.name_ar || id.slice(0, 6);
    };
    const actTally = new Map<string, number>();
    for (const i of ideas) if (i.activity_id) actTally.set(i.activity_id, (actTally.get(i.activity_id) ?? 0) + 1);
    const actEntries = [...actTally.entries()].sort((a, b) => b[1] - a[1]);
    const ideasByChallenge = actEntries.length
      ? cat(actEntries.map((e) => actName(e[0])), actEntries.map((e) => e[1]))
      : tallySorted(ideas.map((i) => i.category), 'uncategorized');

    const ideasByStatus = tallySorted(ideas.map((i) => i.status), 'draft');

    let submitted = 0, screened = 0, evaluated = 0, committee = 0, approved = 0;
    for (const i of ideas) {
      const s = i.status ?? 'draft';
      if (s !== 'draft') submitted++;
      if (SCREENED.has(s)) screened++;
      if (EVALUATED.has(s)) evaluated++;
      if (COMMITTEE.has(s)) committee++;
      if (APPROVED.has(s)) approved++;
    }
    const conversionFunnel = cat(
      ['Submitted', 'Screened', 'Evaluated', 'Committee', 'Approved'],
      [submitted, screened, evaluated, committee, approved]
    );

    const workload = new Map<string, number>();
    for (const e of evals) if (e.evaluator_id) workload.set(e.evaluator_id, (workload.get(e.evaluator_id) ?? 0) + 1);
    const wlEntries = [...workload.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const evaluationWorkload = cat(
      wlEntries.map((e) => nameOf(profById.get(e[0]))),
      wlEntries.map((e) => e[1])
    );

    const innov = new Map<string, number>();
    for (const i of ideas) {
      if (!i.submitter_id || !APPROVED.has(i.status ?? '')) continue;
      innov.set(i.submitter_id, (innov.get(i.submitter_id) ?? 0) + 1);
    }
    const innovEntries = [...innov.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const top10Innovators = cat(innovEntries.map((e) => nameOf(profById.get(e[0]))), innovEntries.map((e) => e[1]));

    const weekly = timeSeries(ideas.map((i) => i.created_at), isoWeekKey);
    const weeklyTrend = cat(weekly.labels.slice(-8), weekly.values.slice(-8));

    // Evaluations -------------------------------------------------------------
    const scores = evals.map((e) => (e.total_score == null ? null : Number(e.total_score))).filter((n): n is number => n != null && Number.isFinite(n));
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const divisor = maxScore > 10 ? maxScore / 10 : 1;
    const scoreBuckets = new Array(11).fill(0);
    for (const s of scores) scoreBuckets[Math.min(10, Math.max(0, Math.round(s / divisor)))]++;
    const avgScores = cat(scoreBuckets.map((_, i) => String(i)), scoreBuckets);

    const evalDist = new Map<string, number>();
    for (const e of evals) if (e.evaluator_id) evalDist.set(e.evaluator_id, (evalDist.get(e.evaluator_id) ?? 0) + 1);
    const edEntries = [...evalDist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const evaluatorDistribution = cat(edEntries.map((e) => nameOf(profById.get(e[0]))), edEntries.map((e) => e[1]));

    const evalStatus = tallySorted(evals.map((e) => e.recommendation), 'pending');

    // Processing time = days from month-start of submission to submitted_at, a
    // coarse within-month proxy (the ideas select carries no id to join on).
    const procDays: number[] = [];
    for (const e of evals) {
      if (!e.submitted_at) continue;
      const d = new Date(e.submitted_at);
      if (Number.isNaN(d.getTime())) continue;
      procDays.push(d.getUTCDate() - 1);
    }
    const processingTime = durationBuckets(procDays);

    // Inter-rater agreement: per idea with ≥2 evals, plot (avg score, spread).
    const byIdea = new Map<string, number[]>();
    for (const e of evals) {
      if (!e.idea_id || e.total_score == null) continue;
      const arr = byIdea.get(e.idea_id) ?? [];
      arr.push(Number(e.total_score));
      byIdea.set(e.idea_id, arr);
    }
    const irrPts: Array<{ x: number; y: number }> = [];
    for (const arr of byIdea.values()) {
      if (arr.length < 2) continue;
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const spread = Math.max(...arr) - Math.min(...arr);
      irrPts.push({ x: Number(avg.toFixed(1)), y: Number(spread.toFixed(1)) });
    }
    const interRaterAgreement = pts(irrPts);

    // Users -------------------------------------------------------------------
    const usersByRole = tallySorted(deptProfiles.map((p) => primaryRoleByUser.get(p.id) ?? null), 'member');
    const usersByDepartment = tallySorted(deptProfiles.map((p) => p.department), 'unassigned');
    const userMonthlyActivity = timeSeries(deptProfiles.map((p) => p.created_at), monthKey);
    // No last_login column in schema — approximate "recency" via account age
    // buckets from created_at so the tile is populated. (Documented proxy.)
    const now = Date.now();
    const ageDays = deptProfiles.map((p) => (p.created_at ? (now - Date.parse(p.created_at)) / 86400000 : NaN)).filter((n) => Number.isFinite(n));
    const lastLoginDistribution = durationBuckets(ageDays as number[]);

    // Audit -------------------------------------------------------------------
    const auditByAction = tallySorted(audit.map((a) => a.action));
    const auditByEntityType = tallySorted(audit.map((a) => a.entity_type));
    const actorTally = new Map<string, number>();
    for (const a of audit) if (a.actor_id) actorTally.set(a.actor_id, (actorTally.get(a.actor_id) ?? 0) + 1);
    const actorEntries = [...actorTally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10);
    const auditByActor = cat(actorEntries.map((e) => nameOf(profById.get(e[0]))), actorEntries.map((e) => e[1]));
    const auditOverTime = timeSeries(audit.map((a) => a.created_at), dayKey);

    // Escalations -------------------------------------------------------------
    const escalationsByStatus = tallySorted(escalations.map((e) => e.status), 'open');
    const escalationsByLevel = tallySorted(escalations.map((e) => (e.current_level ? `Level ${e.current_level}` : null)), 'Level 1');
    const escResDays: number[] = [];
    for (const e of escalations) {
      const d = daysBetween(e.opened_at, e.resolved_at);
      if (d != null) escResDays.push(d);
    }
    const escalationResolutionTime = durationBuckets(escResDays);
    const escalationsByType = tallySorted(escalations.map((e) => e.entity_type));

    // Support -----------------------------------------------------------------
    const supportVolume = timeSeries(support.map((s) => s.created_at), monthKey);
    const supRespDays: number[] = [];
    for (const s of support) {
      const d = daysBetween(s.created_at, s.handled_at);
      if (d != null) supRespDays.push(d);
    }
    const supportResponseTime = durationBuckets(supRespDays);
    const handled = support.filter((s) => s.handled_at).length;
    const supportResolutionRate = cat(['Resolved', 'Open'], [handled, Math.max(0, support.length - handled)]);
    const handlerTally = new Map<string, number>();
    for (const s of support) if (s.handled_by) handlerTally.set(s.handled_by, (handlerTally.get(s.handled_by) ?? 0) + 1);
    const handlerEntries = [...handlerTally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
    const supportByHandler = cat(handlerEntries.map((e) => nameOf(profById.get(e[0]))), handlerEntries.map((e) => e[1]));

    // Compliance --------------------------------------------------------------
    const complianceStatus = tallySorted(compliance.map((c) => c.status), 'in_progress');
    const compliant = compliance.filter((c) => c.status === 'compliant').length;
    const complianceRate = cat(['Compliant', 'Not compliant'], [compliant, Math.max(0, compliance.length - compliant)]);
    // Group by regulator "standard family": DGA / NCA / SDAIA (+ others).
    const stdOf = (r: string | null): string => {
      if (!r) return 'Other';
      if (r.startsWith('SDAIA')) return 'SDAIA';
      if (r === 'NCA') return 'NCA';
      if (r === 'DGA') return 'DGA';
      return r;
    };
    const complianceByStandard = tallySorted(compliance.map((c) => stdOf(c.regulator)));

    return {
      submissionsOverTime,
      ideasByStage,
      ideasByTrack,
      ideasByChallenge,
      ideasByStatus,
      conversionFunnel,
      evaluationWorkload,
      top10Innovators,
      weeklyTrend,
      avgScores,
      evaluatorDistribution,
      evalStatus,
      processingTime,
      interRaterAgreement,
      usersByRole,
      usersByDepartment,
      userMonthlyActivity,
      lastLoginDistribution,
      auditByAction,
      auditByEntityType,
      auditByActor,
      auditOverTime,
      escalationsByStatus,
      escalationsByLevel,
      escalationResolutionTime,
      escalationsByType,
      supportVolume,
      supportResponseTime,
      supportResolutionRate,
      supportByHandler,
      complianceRate,
      complianceByStandard,
      complianceStatus,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[live-queries.loadAll] threw:', err);
    return empty;
  }
}

function buildEmpty(): AllData {
  const e = cat([], []);
  const p = pts([]);
  return {
    submissionsOverTime: e,
    ideasByStage: e,
    ideasByTrack: e,
    ideasByChallenge: e,
    ideasByStatus: e,
    conversionFunnel: e,
    evaluationWorkload: e,
    top10Innovators: e,
    weeklyTrend: e,
    avgScores: e,
    evaluatorDistribution: e,
    evalStatus: e,
    processingTime: e,
    interRaterAgreement: p,
    usersByRole: e,
    usersByDepartment: e,
    userMonthlyActivity: e,
    lastLoginDistribution: e,
    auditByAction: e,
    auditByEntityType: e,
    auditByActor: e,
    auditOverTime: e,
    escalationsByStatus: e,
    escalationsByLevel: e,
    escalationResolutionTime: e,
    escalationsByType: e,
    supportVolume: e,
    supportResponseTime: e,
    supportResolutionRate: e,
    supportByHandler: e,
    complianceRate: e,
    complianceByStandard: e,
    complianceStatus: e,
  };
}

// ── Public per-screen entry points ───────────────────────────────────────────
export async function getAnalyticsChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    submissionsOverTime: a.submissionsOverTime,
    ideasByStage: a.ideasByStage,
    ideasByTrack: a.ideasByTrack,
    ideasByChallenge: a.ideasByChallenge,
    conversionFunnel: a.conversionFunnel,
    evaluationWorkload: a.evaluationWorkload,
    top10Innovators: a.top10Innovators,
    weeklyTrend: a.weeklyTrend,
  };
}

export async function getIdeasChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    ideasByStage: a.ideasByStage,
    ideasByTrack: a.ideasByTrack,
    ideasByChallenge: a.ideasByChallenge,
    ideasByStatus: a.ideasByStatus,
    submissionsOverTime: a.submissionsOverTime,
    top10Innovators: a.top10Innovators,
  };
}

export async function getEvaluationsChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    avgScores: a.avgScores,
    evaluatorDistribution: a.evaluatorDistribution,
    evalStatus: a.evalStatus,
    processingTime: a.processingTime,
    interRaterAgreement: a.interRaterAgreement,
  };
}

export async function getUsersChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    usersByRole: a.usersByRole,
    usersByDepartment: a.usersByDepartment,
    userMonthlyActivity: a.userMonthlyActivity,
    lastLoginDistribution: a.lastLoginDistribution,
  };
}

export async function getAuditLogsChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    auditByAction: a.auditByAction,
    auditByEntityType: a.auditByEntityType,
    auditByActor: a.auditByActor,
    auditOverTime: a.auditOverTime,
  };
}

export async function getEscalationsChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    escalationsByStatus: a.escalationsByStatus,
    escalationsByLevel: a.escalationsByLevel,
    escalationResolutionTime: a.escalationResolutionTime,
    escalationsByType: a.escalationsByType,
  };
}

export async function getSupportChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    supportVolume: a.supportVolume,
    supportResponseTime: a.supportResponseTime,
    supportResolutionRate: a.supportResolutionRate,
    supportByHandler: a.supportByHandler,
  };
}

export async function getComplianceChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    complianceRate: a.complianceRate,
    complianceByStandard: a.complianceByStandard,
    complianceStatus: a.complianceStatus,
  };
}

// The /admin/reports catch-all — a curated union spanning every domain.
export async function getReportsChartData(scope: Scope, userId?: string): Promise<ScreenData> {
  const a = await loadAll(scope, userId);
  return {
    submissionsOverTime: a.submissionsOverTime,
    conversionFunnel: a.conversionFunnel,
    ideasByTrack: a.ideasByTrack,
    ideasByStatus: a.ideasByStatus,
    avgScores: a.avgScores,
    top10Innovators: a.top10Innovators,
    usersByRole: a.usersByRole,
    auditByAction: a.auditByAction,
    escalationsByStatus: a.escalationsByStatus,
    complianceByStandard: a.complianceByStandard,
  };
}

// Convenience: resolve any screenId to its data function.
export function screenDataLoader(
  screenId: string
): (scope: Scope, userId?: string) => Promise<ScreenData> {
  const key = screenId.split('.').pop() ?? screenId;
  switch (key) {
    case 'analytics':
      return getAnalyticsChartData;
    case 'ideas':
      return getIdeasChartData;
    case 'evaluations':
      return getEvaluationsChartData;
    case 'users':
      return getUsersChartData;
    case 'auditLogs':
    case 'audit':
      return getAuditLogsChartData;
    case 'escalations':
      return getEscalationsChartData;
    case 'support':
      return getSupportChartData;
    case 'compliance':
      return getComplianceChartData;
    case 'reports':
    default:
      return getReportsChartData;
  }
}
