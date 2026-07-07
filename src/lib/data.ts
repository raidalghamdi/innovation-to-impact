// Data access layer. Reads from Supabase when configured, otherwise falls
// back to the demo dataset so the app renders fully during build/preview.
//
// Every fetch logs Supabase errors to stderr so that PostgREST / RLS / schema
// misconfigurations surface in Vercel logs instead of being silently masked
// by the demo fallback.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';
import { isFullScope, scopeAllowsTheme, type Scope } from '@/lib/scope';

function logSupabaseError(fn: string, error: unknown) {
  if (!error) return;
  // Log the full error object; PostgREST returns { message, code, details, hint }.
  // eslint-disable-next-line no-console
  console.error(`[${fn}] supabase error:`, error);
}

export async function fetchIdeas() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    logSupabaseError('fetchIdeas', error);
    if (data && data.length) return data as unknown as demo.Idea[];
  }
  return demo.ideas;
}

export async function fetchThemes() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('strategic_themes').select('*');
    logSupabaseError('fetchThemes', error);
    if (data && data.length) return data as unknown as demo.StrategicTheme[];
  }
  return demo.themes;
}

export async function fetchActivities() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('activities').select('*');
    logSupabaseError('fetchActivities', error);
    if (data && data.length) return data as unknown as demo.Activity[];
  }
  return demo.activities;
}

export async function fetchCompliance() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('compliance_controls')
      .select('*')
      .order('regulator');
    logSupabaseError('fetchCompliance', error);
    if (data && data.length) return data as unknown as demo.ComplianceControl[];
  }
  return demo.compliance;
}

export async function fetchBenefits() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('benefits').select('*');
    logSupabaseError('fetchBenefits', error);
    if (data && data.length) return data as unknown as demo.Benefit[];
  }
  return demo.benefits;
}

export async function fetchKnowledge() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('knowledge_articles')
      .select('*')
      .order('published_at', { ascending: false });
    logSupabaseError('fetchKnowledge', error);
    if (data && data.length) return data as unknown as demo.KnowledgeArticle[];
  }
  return demo.knowledge;
}

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

// Demo audit rows used only when Supabase is unconfigured, so both the admin
// dashboard card and the /admin/audit page render identical sample data during
// build/preview instead of diverging.
const DEMO_AUDIT: AuditLog[] = [
  { id: 'al1', actor_id: null, action: 'idea.status_changed', entity_type: 'idea', entity_id: null, created_at: '2026-03-12T10:14:00' },
  { id: 'al2', actor_id: null, action: 'committee.approved', entity_type: 'idea', entity_id: null, created_at: '2026-03-11T16:02:00' },
  { id: 'al3', actor_id: null, action: 'evaluation.submit', entity_type: 'idea', entity_id: null, created_at: '2026-03-10T09:31:00' },
  { id: 'al4', actor_id: null, action: 'knowledge.published', entity_type: 'knowledge_article', entity_id: null, created_at: '2026-03-09T14:48:00' },
];

// Single source of truth for the audit trail. Both /admin and /admin/audit read
// through here so they can never diverge (the F-23 regression). Reads the real
// innovation.audit_logs table when Supabase is configured; otherwise returns
// demo rows.
export async function fetchAuditLogs(limit = 100): Promise<AuditLog[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    logSupabaseError('fetchAuditLogs', error);
    return (data as AuditLog[]) ?? [];
  }
  return DEMO_AUDIT.slice(0, limit);
}

// Standards-traceability control (migration 00006 model). Distinct from the
// legacy demo.ComplianceControl shape used by fetchCompliance().
export type ComplianceControlV2 = {
  id: string;
  standard_body: string;
  control_code: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  mapped_feature_paths: string[] | null;
  evidence_urls: string[] | null;
  owner_id: string | null;
  status: string;
  last_reviewed_at: string | null;
};

const DEMO_CONTROLS: ComplianceControlV2[] = [
  { id: 'cc-sdaia-1', standard_body: 'SDAIA', control_code: 'SDAIA-AI-01', title_en: 'AI ethics assessment', title_ar: 'تقييم أخلاقيات الذكاء الاصطناعي', description_en: 'AI features carry a documented ethics assessment.', description_ar: 'توثيق تقييم أخلاقي لميزات الذكاء الاصطناعي.', mapped_feature_paths: ['src/lib/ai/'], evidence_urls: [], owner_id: null, status: 'in_progress', last_reviewed_at: '2026-05-01' },
  { id: 'cc-ndmo-1', standard_body: 'NDMO', control_code: 'NDMO-DM-04', title_en: 'Data classification', title_ar: 'تصنيف البيانات', description_en: 'Personal data classified per NDMO policy.', description_ar: 'تصنيف البيانات الشخصية وفق سياسة مكتب إدارة البيانات.', mapped_feature_paths: ['supabase/migrations/'], evidence_urls: [], owner_id: null, status: 'met', last_reviewed_at: '2026-04-18' },
  { id: 'cc-dga-1', standard_body: 'DGA', control_code: 'DGA-DX-02', title_en: 'Bilingual digital service', title_ar: 'خدمة رقمية ثنائية اللغة', description_en: 'Service available in Arabic and English with RTL.', description_ar: 'توفر الخدمة بالعربية والإنجليزية مع دعم الاتجاه من اليمين لليسار.', mapped_feature_paths: ['messages/ar.json', 'messages/en.json'], evidence_urls: [], owner_id: null, status: 'met', last_reviewed_at: '2026-04-30' },
  { id: 'cc-nca-1', standard_body: 'NCA', control_code: 'NCA-ECC-1-2', title_en: 'Audit logging', title_ar: 'تسجيل التدقيق', description_en: 'Tamper-evident audit trail for key actions.', description_ar: 'سجل تدقيق محميّ من التلاعب للإجراءات المهمة.', mapped_feature_paths: ['src/lib/audit.ts', 'supabase/migrations/00005_audit_hash_chain.sql'], evidence_urls: [], owner_id: null, status: 'met', last_reviewed_at: '2026-06-01' },
  { id: 'cc-cst-1', standard_body: 'CST', control_code: 'CST-DH-03', title_en: 'Data hosting region', title_ar: 'منطقة استضافة البيانات', description_en: 'Data hosted in approved region.', description_ar: 'استضافة البيانات في منطقة معتمدة.', mapped_feature_paths: [], evidence_urls: [], owner_id: null, status: 'not_started', last_reviewed_at: null },
  { id: 'cc-rdia-1', standard_body: 'RDIA', control_code: 'RDIA-IN-01', title_en: 'Innovation reporting', title_ar: 'تقارير الابتكار', description_en: 'Innovation KPIs reported to RDIA.', description_ar: 'رفع مؤشرات الابتكار إلى هيئة البحث والتطوير والابتكار.', mapped_feature_paths: ['src/app/[locale]/analytics/'], evidence_urls: [], owner_id: null, status: 'not_applicable', last_reviewed_at: null },
];

export const STANDARD_BODIES = ['SDAIA', 'NDMO', 'DGA', 'NCA', 'CST', 'RDIA'] as const;

export async function fetchComplianceControls(): Promise<ComplianceControlV2[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('compliance_controls')
        .select('id, standard_body, control_code, title_ar, title_en, description_ar, description_en, mapped_feature_paths, evidence_urls, owner_id, status, last_reviewed_at')
        .order('standard_body');
      logSupabaseError('fetchComplianceControls', error);
      if (data && data.length) return data as unknown as ComplianceControlV2[];
    }
  }
  return DEMO_CONTROLS;
}

export type AuditFilters = {
  entityType?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type AuditRow = AuditLog & {
  chain_seq: number | null;
  row_hash: string | null;
};

export type AuditPage = {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  actorLabels: Record<string, string>;
};

const AUDIT_SELECT = 'id, actor_id, action, entity_type, entity_id, created_at, chain_seq, row_hash';

// Resolve actor ids to a human label (email → full name → short id) via
// user_profiles. Best-effort: tolerates a missing email column and never throws.
async function resolveActorLabels(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ids: string[]
): Promise<Record<string, string>> {
  type ProfileRow = { id: string; email?: string | null; full_name?: string | null };
  const labels: Record<string, string> = {};
  if (!ids.length) return labels;
  let rows: ProfileRow[] | null = null;
  const withEmail = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .in('id', ids);
  if (withEmail.error) {
    const fallback = await supabase.from('user_profiles').select('id, full_name').in('id', ids);
    logSupabaseError('resolveActorLabels', fallback.error);
    rows = (fallback.data as unknown as ProfileRow[]) ?? null;
  } else {
    rows = (withEmail.data as unknown as ProfileRow[]) ?? null;
  }
  for (const r of rows ?? []) {
    labels[r.id] = r.email || r.full_name || `${r.id.slice(0, 8)}…`;
  }
  return labels;
}

// Filtered, server-paginated audit page for the admin viewer. Selects the
// hash-chain columns (chain_seq, row_hash) added in migration 00005.
export async function fetchAuditPage(filters: AuditFilters = {}): Promise<AuditPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 25;
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('audit_logs').select(AUDIT_SELECT, { count: 'exact' });
      if (filters.entityType) q = q.eq('entity_type', filters.entityType);
      if (filters.action) q = q.ilike('action', `%${filters.action}%`);
      if (filters.actorId) q = q.eq('actor_id', filters.actorId);
      if (filters.from) q = q.gte('created_at', filters.from);
      if (filters.to) q = q.lte('created_at', filters.to);
      const { data, error, count } = await q
        .order('created_at', { ascending: false })
        .range(fromIdx, toIdx);
      logSupabaseError('fetchAuditPage', error);
      const rows = (data as AuditRow[]) ?? [];
      const actorIds = Array.from(
        new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))
      );
      const actorLabels = await resolveActorLabels(supabase, actorIds);
      return { rows, total: count ?? rows.length, page, pageSize, actorLabels };
    }
  }

  // Demo fallback: synthesise chain_seq/row_hash so the viewer renders.
  const demoRows: AuditRow[] = DEMO_AUDIT.map((r, i) => ({
    ...r,
    chain_seq: DEMO_AUDIT.length - i,
    row_hash: null,
  }));
  return { rows: demoRows.slice(fromIdx, toIdx + 1), total: demoRows.length, page, pageSize, actorLabels: {} };
}

export type EvaluatorScorecard = {
  evaluatorId: string;
  evaluatorName: string;
  totalScore: number | null;
  criteriaScores: Record<string, number> | null;
  comments: string | null;
  conflict: boolean;
  submittedAt: string | null;
};

export type EvaluationSummary = {
  ideaId: string;
  count: number;
  avgTotal: number | null;
  perCriterion: Record<string, number>;
  conflicts: number;
  scorecards: EvaluatorScorecard[];
};

// Aggregate submitted evaluations per idea for the committee queue: average
// total score, per-criterion averages, submitted evaluator count and how many
// evaluators declared a conflict. Draft rows (submitted_at IS NULL) are
// excluded. Returns a map keyed by idea_id; empty when Supabase is unconfigured.
export async function fetchEvaluationSummaries(
  ideaIds: string[]
): Promise<Record<string, EvaluationSummary>> {
  const result: Record<string, EvaluationSummary> = {};
  if (!ideaIds.length || !isSupabaseConfigured()) return result;

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from('evaluations')
    .select(
      'idea_id, evaluator_id, total_score, criteria_scores, comments, conflict_of_interest, submitted_at'
    )
    .in('idea_id', ideaIds)
    .not('submitted_at', 'is', null);
  logSupabaseError('fetchEvaluationSummaries', error);
  if (!data) return result;

  type Row = {
    idea_id: string;
    evaluator_id: string;
    total_score: number | null;
    criteria_scores: Record<string, number> | null;
    comments: string | null;
    conflict_of_interest: boolean | null;
    submitted_at: string | null;
  };
  const rows = data as Row[];

  // Resolve evaluator display names in one call.
  const evaluatorIds = Array.from(new Set(rows.map((r) => r.evaluator_id)));
  const nameById = new Map<string, string>();
  if (evaluatorIds.length) {
    const { data: users } = await supabase!
      .from('user_profiles')
      .select('id, full_name, full_name_ar, email')
      .in('id', evaluatorIds);
    for (const u of (users ?? []) as Array<{
      id: string;
      full_name: string | null;
      full_name_ar: string | null;
      email: string | null;
    }>) {
      nameById.set(u.id, u.full_name || u.full_name_ar || u.email || u.id);
    }
  }

  const acc: Record<
    string,
    {
      totals: number[];
      criterion: Record<string, number[]>;
      conflicts: number;
      count: number;
      scorecards: EvaluatorScorecard[];
    }
  > = {};

  for (const row of rows) {
    const bucket = (acc[row.idea_id] ??= {
      totals: [],
      criterion: {},
      conflicts: 0,
      count: 0,
      scorecards: [],
    });
    bucket.count += 1;
    bucket.scorecards.push({
      evaluatorId: row.evaluator_id,
      evaluatorName: nameById.get(row.evaluator_id) ?? row.evaluator_id,
      totalScore: row.total_score,
      criteriaScores: row.criteria_scores,
      comments: row.comments,
      conflict: Boolean(row.conflict_of_interest),
      submittedAt: row.submitted_at,
    });
    if (row.conflict_of_interest) {
      bucket.conflicts += 1;
      continue;
    }
    if (typeof row.total_score === 'number') bucket.totals.push(row.total_score);
    if (row.criteria_scores) {
      for (const [key, value] of Object.entries(row.criteria_scores)) {
        if (typeof value === 'number') (bucket.criterion[key] ??= []).push(value);
      }
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  for (const [ideaId, bucket] of Object.entries(acc)) {
    result[ideaId] = {
      ideaId,
      count: bucket.count,
      avgTotal: bucket.totals.length ? Math.round(avg(bucket.totals) * 10) / 10 : null,
      perCriterion: Object.fromEntries(
        Object.entries(bucket.criterion).map(([k, v]) => [k, Math.round(avg(v) * 10) / 10])
      ),
      conflicts: bucket.conflicts,
      scorecards: bucket.scorecards,
    };
  }

  return result;
}

export async function fetchUsers() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase!.from('user_profiles').select('*');
    logSupabaseError('fetchUsers', error);
    if (data && data.length) return data as unknown as demo.UserProfile[];
  }
  return demo.users;
}

// ---------------------------------------------------------------------------
// Evaluator assignments (WS3)
//
// NOTE: the WS3 brief describes the live innovation.assignments table with the
// evaluator model (evaluator_id, assigned_by, assigned_at, due_at, notes,
// status ∈ pending|completed|declined). Migration 00001 still ships the older
// owner_id/due_date/status='open' shape; reconciling that schema is out of
// scope for WS3 (see TODO in the final report). Queries here target the
// evaluator model and stitch related idea/evaluator rows in JS rather than
// relying on PostgREST embedding, which needs FK hints that may not exist yet.
// ---------------------------------------------------------------------------

export const ASSIGNMENT_STATUSES = ['pending', 'completed', 'declined'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type Assignment = {
  id: string;
  idea_id: string;
  evaluator_id: string;
  assigned_by: string | null;
  assigned_at: string | null;
  due_at: string | null;
  status: string;
  notes: string | null;
};

// Assignment enriched with the joined idea + evaluator display fields the UI
// needs (bilingual idea title, idea code, evaluator email/name).
export type AssignmentRow = Assignment & {
  idea_code: string | null;
  idea_title_ar: string | null;
  idea_title_en: string | null;
  evaluator_email: string | null;
  evaluator_name: string | null;
};

export type AssignmentFilters = {
  evaluatorId?: string;
  status?: string;
  ideaSearch?: string;
  page?: number;
  pageSize?: number;
};

export type AssignmentPage = {
  rows: AssignmentRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEMO_ASSIGNMENTS: Assignment[] = [
  { id: 'as1', idea_id: 'i4', evaluator_id: 'u2', assigned_by: 'u1', assigned_at: '2026-06-20T09:00:00', due_at: '2026-06-23T09:00:00', status: 'pending', notes: null },
  { id: 'as2', idea_id: 'i6', evaluator_id: 'u2', assigned_by: 'u1', assigned_at: '2026-07-01T09:00:00', due_at: '2026-07-06T09:00:00', status: 'pending', notes: 'Priority review' },
  { id: 'as3', idea_id: 'i7', evaluator_id: 'u3', assigned_by: 'u1', assigned_at: '2026-06-15T09:00:00', due_at: '2026-06-18T09:00:00', status: 'pending', notes: null },
  { id: 'as4', idea_id: 'i6', evaluator_id: 'u4', assigned_by: 'u1', assigned_at: '2026-07-02T09:00:00', due_at: '2026-07-09T09:00:00', status: 'pending', notes: null },
  { id: 'as5', idea_id: 'i4', evaluator_id: 'u5', assigned_by: 'u1', assigned_at: '2026-06-30T09:00:00', due_at: '2026-06-28T09:00:00', status: 'completed', notes: null },
  { id: 'as6', idea_id: 'i7', evaluator_id: 'u5', assigned_by: 'u1', assigned_at: '2026-06-10T09:00:00', due_at: '2026-06-12T09:00:00', status: 'declined', notes: 'Conflict of interest' },
];

// Enrich a set of assignments with idea/evaluator display fields from the demo
// dataset. Shared by the Supabase-unconfigured fallbacks below.
function enrichFromDemo(rows: Assignment[]): AssignmentRow[] {
  return rows.map((a) => {
    const idea = demo.ideas.find((i) => i.id === a.idea_id);
    const ev = demo.users.find((u) => u.id === a.evaluator_id);
    return {
      ...a,
      idea_code: idea?.code ?? null,
      idea_title_ar: idea?.title_ar ?? null,
      idea_title_en: idea?.title_en ?? null,
      evaluator_email: ev?.email ?? null,
      evaluator_name: ev?.full_name ?? null,
    };
  });
}

async function enrichAssignments(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: Assignment[]
): Promise<AssignmentRow[]> {
  const ideaIds = Array.from(new Set(rows.map((r) => r.idea_id).filter(Boolean)));
  const evalIds = Array.from(new Set(rows.map((r) => r.evaluator_id).filter(Boolean)));

  const ideaById = new Map<string, { code: string | null; title_ar: string | null; title_en: string | null }>();
  if (ideaIds.length) {
    const { data } = await supabase.from('ideas').select('id, code, title_ar, title_en').in('id', ideaIds);
    for (const i of (data ?? []) as Array<{ id: string; code: string | null; title_ar: string | null; title_en: string | null }>) {
      ideaById.set(i.id, { code: i.code, title_ar: i.title_ar, title_en: i.title_en });
    }
  }

  const evById = new Map<string, { email: string | null; full_name: string | null }>();
  if (evalIds.length) {
    const { data } = await supabase.from('user_profiles').select('id, email, full_name').in('id', evalIds);
    for (const u of (data ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) {
      evById.set(u.id, { email: u.email, full_name: u.full_name });
    }
  }

  return rows.map((a) => {
    const idea = ideaById.get(a.idea_id);
    const ev = evById.get(a.evaluator_id);
    return {
      ...a,
      idea_code: idea?.code ?? null,
      idea_title_ar: idea?.title_ar ?? null,
      idea_title_en: idea?.title_en ?? null,
      evaluator_email: ev?.email ?? null,
      evaluator_name: ev?.full_name ?? null,
    };
  });
}

const ASSIGNMENT_SELECT = 'id, idea_id, evaluator_id, assigned_by, assigned_at, due_at, status, notes';

// Filtered, server-paginated assignment list for the admin viewer.
export async function fetchAssignmentsPage(filters: AssignmentFilters = {}): Promise<AssignmentPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 25;
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('assignments').select(ASSIGNMENT_SELECT, { count: 'exact' });
      if (filters.evaluatorId) q = q.eq('evaluator_id', filters.evaluatorId);
      if (filters.status) q = q.eq('status', filters.status);
      const { data, error, count } = await q
        .order('assigned_at', { ascending: false })
        .range(fromIdx, toIdx);
      logSupabaseError('fetchAssignmentsPage', error);
      let rows = await enrichAssignments(supabase, (data as Assignment[]) ?? []);
      // Idea search is applied post-enrichment so it can match the bilingual
      // title/code the admin actually sees.
      if (filters.ideaSearch) {
        const needle = filters.ideaSearch.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.idea_code?.toLowerCase().includes(needle) ||
            r.idea_title_ar?.toLowerCase().includes(needle) ||
            r.idea_title_en?.toLowerCase().includes(needle)
        );
      }
      return { rows, total: filters.ideaSearch ? rows.length : count ?? rows.length, page, pageSize };
    }
  }

  // Demo fallback.
  let demoRows = enrichFromDemo(DEMO_ASSIGNMENTS);
  if (filters.evaluatorId) demoRows = demoRows.filter((r) => r.evaluator_id === filters.evaluatorId);
  if (filters.status) demoRows = demoRows.filter((r) => r.status === filters.status);
  if (filters.ideaSearch) {
    const needle = filters.ideaSearch.toLowerCase();
    demoRows = demoRows.filter(
      (r) =>
        r.idea_code?.toLowerCase().includes(needle) ||
        r.idea_title_ar?.toLowerCase().includes(needle) ||
        r.idea_title_en?.toLowerCase().includes(needle)
    );
  }
  return { rows: demoRows.slice(fromIdx, toIdx + 1), total: demoRows.length, page, pageSize };
}

export type WorkloadCell = { pending: number; dueSoon: number; overdue: number; completedRecent: number };
export type WorkloadRow = {
  evaluatorId: string;
  evaluatorLabel: string;
  cells: WorkloadCell;
};

const DUE_SOON_MS = 48 * 60 * 60 * 1000;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

// Classify one assignment into a workload bucket relative to `now`.
function bucketOf(a: Assignment, now: number): keyof WorkloadCell | null {
  if (a.status === 'completed') {
    if (a.assigned_at && now - new Date(a.assigned_at).getTime() <= RECENT_MS) return 'completedRecent';
    return null;
  }
  if (a.status !== 'pending') return null; // declined etc. not shown
  if (!a.due_at) return 'pending';
  const due = new Date(a.due_at).getTime();
  if (due < now) return 'overdue';
  if (due - now <= DUE_SOON_MS) return 'dueSoon';
  return 'pending';
}

// Aggregate assignments per evaluator into the heatmap buckets.
export async function fetchWorkloadHeatmap(): Promise<WorkloadRow[]> {
  const now = Date.now();
  const empty = (): WorkloadCell => ({ pending: 0, dueSoon: 0, overdue: 0, completedRecent: 0 });

  let rows: Assignment[] = DEMO_ASSIGNMENTS;
  const labelById = new Map<string, string>();
  for (const u of demo.users) labelById.set(u.id, u.email || u.full_name || u.id);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.from('assignments').select(ASSIGNMENT_SELECT);
      logSupabaseError('fetchWorkloadHeatmap', error);
      rows = (data as Assignment[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.evaluator_id)));
      labelById.clear();
      if (ids.length) {
        const { data: users } = await supabase.from('user_profiles').select('id, email, full_name').in('id', ids);
        for (const u of (users ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) {
          labelById.set(u.id, u.email || u.full_name || u.id);
        }
      }
    }
  }

  const acc = new Map<string, WorkloadCell>();
  for (const a of rows) {
    const b = bucketOf(a, now);
    if (!b) continue;
    const cell = acc.get(a.evaluator_id) ?? empty();
    cell[b] += 1;
    acc.set(a.evaluator_id, cell);
  }

  return Array.from(acc.entries())
    .map(([evaluatorId, cells]) => ({
      evaluatorId,
      evaluatorLabel: labelById.get(evaluatorId) ?? `${evaluatorId.slice(0, 8)}…`,
      cells,
    }))
    .sort((a, b) => a.evaluatorLabel.localeCompare(b.evaluatorLabel));
}

// Idea + evaluator option lists for the "New Assignment" dialog pickers.
export type IdeaOption = { id: string; code: string; title_ar: string; title_en: string };
export async function fetchIdeaOptions(): Promise<IdeaOption[]> {
  const ideas = await fetchIdeas();
  return ideas.map((i) => ({ id: i.id, code: i.code, title_ar: i.title_ar, title_en: i.title_en }));
}

export type EvaluatorOption = { id: string; email: string | null; full_name: string | null };
export async function fetchEvaluatorOptions(): Promise<EvaluatorOption[]> {
  const users = await fetchUsers();
  return users
    .filter((u) => u.role === 'evaluator')
    .map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }));
}

// Evaluator's pending queue, ordered by soonest due first. Empty when
// Supabase is unconfigured and no matching demo rows exist for the user.
// ---------------------------------------------------------------------------
// Evaluator dashboard aggregate
//
// Returns everything the /evaluation page needs in a single call so the page
// can render KPIs, the queue, and per-idea metadata without N extra roundtrips.
// Shape kept flat so the client component doesn't need extra typing gymnastics.
// ---------------------------------------------------------------------------
export type EvaluatorQueueItem = {
  assignment_id: string;
  idea_id: string;
  idea_code: string | null;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  expected_benefits: string | null;
  theme_id: string | null;
  theme_ar: string | null;
  theme_en: string | null;
  team_id: string | null;
  team_ar: string | null;
  team_en: string | null;
  submitted_at: string | null;
  due_at: string | null;
  assignment_status: string;
  eval_status: 'not_started' | 'in_progress' | 'submitted' | 'needs_review';
  eval_id: string | null;
  total_score: number | null;
  innovation_score: number | null;
  submitted_evaluation_at: string | null;
  attachments_count: number;
  has_video: boolean;
};

export type EvaluatorDashboard = {
  totalAssigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  needsReview: number;
  completionPct: number;
  nextDueAt: string | null;
  overdueCount: number;
  queue: EvaluatorQueueItem[];
};

export async function fetchEvaluatorDashboard(evaluatorId: string): Promise<EvaluatorDashboard> {
  // Pull assignments (both pending + completed) so we can show progress. Then
  // enrich each row with idea + theme + team + evaluation state.
  let assignments: Assignment[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('assignments')
        .select(ASSIGNMENT_SELECT)
        .eq('evaluator_id', evaluatorId)
        .in('status', ['pending', 'completed'])
        .order('due_at', { ascending: true });
      logSupabaseError('fetchEvaluatorDashboard.assignments', error);
      assignments = (data as Assignment[]) ?? [];

      const ideaIds = Array.from(new Set(assignments.map((a) => a.idea_id)));

      // Idea details (rich fields for the card)
      const ideaById = new Map<string, any>();
      if (ideaIds.length) {
        const { data: ideas } = await supabase
          .from('ideas')
          .select('id, code, title_ar, title_en, problem_statement, proposed_solution, expected_benefits, strategic_theme_id, team_id, submitted_at, attachments')
          .in('id', ideaIds);
        for (const i of (ideas as any[]) ?? []) ideaById.set(i.id, i);
      }

      // Theme names
      const themeIds = Array.from(new Set([...ideaById.values()].map((i: any) => i.strategic_theme_id).filter(Boolean)));
      const themeById = new Map<string, { title_ar: string; title_en: string }>();
      if (themeIds.length) {
        const { data: themes } = await supabase
          .from('themes')
          .select('id, title_ar, title_en')
          .in('id', themeIds);
        for (const t of (themes as any[]) ?? []) themeById.set(t.id, t);
      }

      // Team names
      const teamIds = Array.from(new Set([...ideaById.values()].map((i: any) => i.team_id).filter(Boolean)));
      const teamById = new Map<string, { name_ar: string | null; name_en: string | null }>();
      if (teamIds.length) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name_ar, name_en')
          .in('id', teamIds);
        for (const tm of (teams as any[]) ?? []) teamById.set(tm.id, tm);
      }

      // Evaluations by this evaluator for these ideas
      const evalByIdea = new Map<string, any>();
      if (ideaIds.length) {
        const { data: evals } = await supabase
          .from('evaluations')
          .select('id, idea_id, criteria_scores, total_score, submitted_at, recommendation')
          .eq('evaluator_id', evaluatorId)
          .in('idea_id', ideaIds);
        for (const e of (evals as any[]) ?? []) evalByIdea.set(e.idea_id, e);
      }

      // Video presence
      const videoIdeaIds = new Set<string>();
      if (ideaIds.length) {
        const { data: vids } = await supabase
          .from('video_assets')
          .select('idea_id')
          .in('idea_id', ideaIds);
        for (const v of (vids as any[]) ?? []) if (v.idea_id) videoIdeaIds.add(v.idea_id);
      }

      const queue: EvaluatorQueueItem[] = assignments.map((a) => {
        const idea = ideaById.get(a.idea_id) ?? {};
        const theme = idea.strategic_theme_id ? themeById.get(idea.strategic_theme_id) : null;
        const team = idea.team_id ? teamById.get(idea.team_id) : null;
        const ev = evalByIdea.get(a.idea_id);
        const innovationScore = ev?.criteria_scores?.innovation ?? ev?.criteria_scores?.innovation_score ?? null;
        let evalStatus: EvaluatorQueueItem['eval_status'] = 'not_started';
        if (ev?.submitted_at) evalStatus = 'submitted';
        else if (ev?.criteria_scores && Object.keys(ev.criteria_scores).length > 0) evalStatus = 'in_progress';
        if (a.status === 'pending' && a.due_at && new Date(a.due_at).getTime() < Date.now() && evalStatus !== 'submitted') {
          evalStatus = 'needs_review';
        }
        return {
          assignment_id: a.id,
          idea_id: a.idea_id,
          idea_code: idea.code ?? null,
          title_ar: idea.title_ar ?? null,
          title_en: idea.title_en ?? null,
          problem_statement: idea.problem_statement ?? null,
          proposed_solution: idea.proposed_solution ?? null,
          expected_benefits: idea.expected_benefits ?? null,
          theme_id: idea.strategic_theme_id ?? null,
          theme_ar: theme?.title_ar ?? null,
          theme_en: theme?.title_en ?? null,
          team_id: idea.team_id ?? null,
          team_ar: team?.name_ar ?? null,
          team_en: team?.name_en ?? null,
          submitted_at: idea.submitted_at ?? null,
          due_at: a.due_at,
          assignment_status: a.status,
          eval_status: evalStatus,
          eval_id: ev?.id ?? null,
          total_score: ev?.total_score ?? null,
          innovation_score: innovationScore != null ? Number(innovationScore) : null,
          submitted_evaluation_at: ev?.submitted_at ?? null,
          attachments_count: Array.isArray(idea.attachments) ? idea.attachments.length : 0,
          has_video: videoIdeaIds.has(a.idea_id),
        };
      });

      const completed = queue.filter((q) => q.eval_status === 'submitted').length;
      const inProgress = queue.filter((q) => q.eval_status === 'in_progress').length;
      const notStarted = queue.filter((q) => q.eval_status === 'not_started').length;
      const needsReview = queue.filter((q) => q.eval_status === 'needs_review').length;
      const pendingDueDates = queue
        .filter((q) => q.eval_status !== 'submitted' && q.due_at)
        .map((q) => q.due_at as string)
        .sort();
      const overdueCount = pendingDueDates.filter((d) => new Date(d).getTime() < Date.now()).length;

      return {
        totalAssigned: queue.length,
        completed,
        inProgress,
        notStarted,
        needsReview,
        completionPct: queue.length === 0 ? 0 : Math.round((completed / queue.length) * 100),
        nextDueAt: pendingDueDates[0] ?? null,
        overdueCount,
        queue,
      };
    }
  }

  // Demo fallback
  const rows = DEMO_ASSIGNMENTS.filter((a) => a.evaluator_id === evaluatorId);
  const enriched = enrichFromDemo(rows);
  const queue: EvaluatorQueueItem[] = enriched.map((a) => ({
    assignment_id: a.id,
    idea_id: a.idea_id,
    idea_code: a.idea_code,
    title_ar: a.idea_title_ar,
    title_en: a.idea_title_en,
    problem_statement: null,
    proposed_solution: null,
    expected_benefits: null,
    theme_id: null,
    theme_ar: null,
    theme_en: null,
    team_id: null,
    team_ar: null,
    team_en: null,
    submitted_at: null,
    due_at: a.due_at,
    assignment_status: a.status,
    eval_status: a.status === 'completed' ? 'submitted' : (a.due_at && new Date(a.due_at).getTime() < Date.now() ? 'needs_review' : 'not_started'),
    eval_id: null,
    total_score: null,
    innovation_score: null,
    submitted_evaluation_at: null,
    attachments_count: 0,
    has_video: false,
  }));
  const completed = queue.filter((q) => q.eval_status === 'submitted').length;
  const pendingDueDates = queue.filter((q) => q.eval_status !== 'submitted' && q.due_at).map((q) => q.due_at as string).sort();
  return {
    totalAssigned: queue.length,
    completed,
    inProgress: queue.filter((q) => q.eval_status === 'in_progress').length,
    notStarted: queue.filter((q) => q.eval_status === 'not_started').length,
    needsReview: queue.filter((q) => q.eval_status === 'needs_review').length,
    completionPct: queue.length === 0 ? 0 : Math.round((completed / queue.length) * 100),
    nextDueAt: pendingDueDates[0] ?? null,
    overdueCount: pendingDueDates.filter((d) => new Date(d).getTime() < Date.now()).length,
    queue,
  };
}

export async function fetchMyQueue(evaluatorId: string): Promise<AssignmentRow[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('assignments')
        .select(ASSIGNMENT_SELECT)
        .eq('evaluator_id', evaluatorId)
        .eq('status', 'pending')
        .order('due_at', { ascending: true });
      logSupabaseError('fetchMyQueue', error);
      return enrichAssignments(supabase, (data as Assignment[]) ?? []);
    }
  }
  const rows = DEMO_ASSIGNMENTS.filter((a) => a.evaluator_id === evaluatorId && a.status === 'pending').sort(
    (a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '')
  );
  return enrichFromDemo(rows);
}

// ---------------------------------------------------------------------------
// WS5 — Executive summary + pillar drill-down.
// Both compose the schema-aware fetchers above (fetchIdeas/Themes/Benefits/
// Users), so they inherit the Supabase-or-demo fallback for free, and apply the
// caller's Scope so a judge only ever sees their assigned themes.
// ---------------------------------------------------------------------------

export type ExecKpi = {
  id: string;
  current: number;
  previous: number;
  series: { date: string; value: number }[];
};
export type PillarSummary = {
  theme_id: string;
  title_ar: string;
  title_en: string;
  count: number;
  budget: number;
  progress: number;
};
export type ExecFunnel = {
  submitted: number;
  under_review: number;
  approved: number;
  pilot: number;
  implemented: number;
};
export type ExecDecision = {
  id: string;
  idea_title_ar: string;
  idea_title_en: string;
  outcome: string;
  decided_at: string;
};
export type ExecutiveSummary = {
  kpis: ExecKpi[];
  byPillar: PillarSummary[];
  funnel: ExecFunnel;
  recentDecisions: ExecDecision[];
};

const APPROVED_STATUSES = new Set([
  'approved',
  'in_pilot',
  'in_implementation',
  'benefits_tracking',
  'closed',
]);
const UNDER_REVIEW_STATUSES = new Set([
  'submitted',
  'screening',
  'evaluation',
  'committee',
  'assigned',
  'returned',
]);
const IMPLEMENTED_STATUSES = new Set(['in_implementation', 'benefits_tracking', 'closed']);

function monthKey(iso: string | null | undefined): string {
  return iso ? String(iso).slice(0, 7) : '';
}

// Per-month counts of ideas matching `predicate`, last `n` months present in
// the data (chronological). Drives the KPI sparklines.
function monthlySeries(
  ideas: demo.Idea[],
  predicate: (i: demo.Idea) => boolean,
  n = 6
): { date: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const i of ideas) {
    if (!predicate(i)) continue;
    const k = monthKey(i.created_at);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-n)
    .map(([date, value]) => ({ date, value }));
}

function cycleDays(i: demo.Idea): number | null {
  const stage = Number(i.current_stage ?? 0);
  if (stage <= 0) return null;
  const start = Date.parse(i.created_at);
  const end = Date.parse(i.updated_at ?? i.created_at);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / (1000 * 60 * 60 * 24);
}

function avgCycle(ideas: demo.Idea[]): number {
  const vals = ideas.map(cycleDays).filter((d): d is number => d !== null);
  if (!vals.length) return 0;
  return Number((vals.reduce((s, d) => s + d, 0) / vals.length).toFixed(1));
}

function approvalRate(ideas: demo.Idea[]): number {
  const submitted = ideas.filter((i) => i.status !== 'draft').length;
  const approved = ideas.filter((i) => APPROVED_STATUSES.has(i.status)).length;
  return submitted > 0 ? Number(((approved / submitted) * 100).toFixed(1)) : 0;
}

export async function fetchExecutiveSummary(scope: Scope): Promise<ExecutiveSummary> {
  const [allIdeas, allThemes, benefits, users] = await Promise.all([
    fetchIdeas(),
    fetchThemes(),
    fetchBenefits(),
    fetchUsers(),
  ]);

  // Scope narrowing: a non-admin only sees ideas/themes for their allowed
  // themes (empty list → nothing).
  const themes = isFullScope(scope)
    ? allThemes
    : allThemes.filter((t) => scopeAllowsTheme(scope, t.id));
  const themeIds = new Set(themes.map((t) => t.id));
  const ideas = isFullScope(scope)
    ? allIdeas
    : allIdeas.filter((i) => themeIds.has(i.strategic_theme_id));

  // Split off the most recent month so KPI deltas compare "now" vs "as of the
  // start of the current month".
  const months = Array.from(new Set(ideas.map((i) => monthKey(i.created_at)).filter(Boolean))).sort();
  const latestMonth = months[months.length - 1] ?? '';
  const prior = ideas.filter((i) => monthKey(i.created_at) < latestMonth);

  const financialFor = (set: demo.Idea[], field: 'realized_value' | 'target_value') => {
    const ids = new Set(set.map((i) => i.id));
    return benefits
      .filter((b) => b.benefit_type === 'financial' && ids.has(b.idea_id))
      .reduce((s, b) => s + (b[field] ?? 0), 0);
  };
  const activePilots = (set: demo.Idea[]) =>
    set.filter((i) => Number(i.current_stage ?? 0) >= 6 && i.status !== 'closed').length;
  const evaluatorsActive = users.filter((u) => u.role === 'evaluator').length;

  const kpis: ExecKpi[] = [
    {
      id: 'ideas_submitted',
      current: ideas.filter((i) => i.status !== 'draft').length,
      previous: prior.filter((i) => i.status !== 'draft').length,
      series: monthlySeries(ideas, (i) => i.status !== 'draft'),
    },
    {
      id: 'avg_cycle_time',
      current: avgCycle(ideas),
      previous: avgCycle(prior),
      series: monthlySeries(ideas, (i) => Number(i.current_stage ?? 0) > 0),
    },
    {
      id: 'approval_rate',
      current: approvalRate(ideas),
      previous: approvalRate(prior),
      series: monthlySeries(ideas, (i) => APPROVED_STATUSES.has(i.status)),
    },
    {
      id: 'active_pilots',
      current: activePilots(ideas),
      previous: activePilots(prior),
      series: monthlySeries(ideas, (i) => Number(i.current_stage ?? 0) >= 6),
    },
    {
      id: 'roi_ytd',
      current: financialFor(ideas, 'realized_value'),
      previous: financialFor(prior, 'realized_value'),
      series: monthlySeries(ideas, (i) => IMPLEMENTED_STATUSES.has(i.status)),
    },
    {
      id: 'evaluators_active',
      current: evaluatorsActive,
      previous: evaluatorsActive,
      series: monthlySeries(ideas, (i) => Number(i.current_stage ?? 0) >= 4),
    },
  ];

  const byPillar: PillarSummary[] = themes
    .map((t) => {
      const themeIdeas = ideas.filter((i) => i.strategic_theme_id === t.id);
      const implemented = themeIdeas.filter((i) => IMPLEMENTED_STATUSES.has(i.status)).length;
      return {
        theme_id: t.id,
        title_ar: t.name_ar,
        title_en: t.name_en,
        count: themeIdeas.length,
        budget: financialFor(themeIdeas, 'realized_value'),
        progress: themeIdeas.length ? Math.round((implemented / themeIdeas.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const funnel: ExecFunnel = {
    submitted: ideas.filter((i) => i.status !== 'draft').length,
    under_review: ideas.filter((i) => UNDER_REVIEW_STATUSES.has(i.status)).length,
    approved: ideas.filter((i) => APPROVED_STATUSES.has(i.status)).length,
    pilot: ideas.filter((i) => Number(i.current_stage ?? 0) >= 6).length,
    implemented: ideas.filter((i) => IMPLEMENTED_STATUSES.has(i.status)).length,
  };

  const recentDecisions = await fetchRecentDecisions(ideas);

  return { kpis, byPillar, funnel, recentDecisions };
}

// Last 10 committee decisions with the idea title. Reads committee_decisions
// when Supabase is live; otherwise derives plausible outcomes from idea status.
async function fetchRecentDecisions(scopedIdeas: demo.Idea[]): Promise<ExecDecision[]> {
  const byId = new Map(scopedIdeas.map((i) => [i.id, i]));
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('committee_decisions')
        .select('id, idea_id, decision, decided_at')
        .order('decided_at', { ascending: false })
        .limit(10);
      logSupabaseError('fetchRecentDecisions', error);
      if (data && data.length) {
        return (data as { id: string; idea_id: string; decision: string; decided_at: string }[])
          .filter((d) => byId.has(d.idea_id))
          .map((d) => {
            const idea = byId.get(d.idea_id)!;
            return {
              id: d.id,
              idea_title_ar: idea.title_ar,
              idea_title_en: idea.title_en,
              outcome: d.decision,
              decided_at: d.decided_at,
            };
          });
      }
    }
  }
  const OUTCOME_BY_STATUS: Record<string, string> = {
    approved: 'approve',
    returned: 'return',
    committee: 'study',
    in_pilot: 'approve',
    in_implementation: 'approve',
    benefits_tracking: 'approve',
    closed: 'approve',
  };
  return scopedIdeas
    .filter((i) => OUTCOME_BY_STATUS[i.status])
    .sort((a, b) => String(b.updated_at ?? b.created_at).localeCompare(String(a.updated_at ?? a.created_at)))
    .slice(0, 10)
    .map((i) => ({
      id: `dec-${i.id}`,
      idea_title_ar: i.title_ar,
      idea_title_en: i.title_en,
      outcome: OUTCOME_BY_STATUS[i.status],
      decided_at: String(i.updated_at ?? i.created_at),
    }));
}

export type PillarDetail = {
  theme: { id: string; title_ar: string; title_en: string; description: string; owner: string | null };
  kpis: { ideas: number; budgetSpent: number; budgetAllocated: number; pilotsActive: number; implementationsDone: number };
  timeline: { date: string; value: number }[];
  ideas: { id: string; code: string; title_ar: string; title_en: string; status: string; current_stage: number }[];
};

export async function fetchPillarDetail(themeId: string, scope: Scope): Promise<PillarDetail | null> {
  if (!scopeAllowsTheme(scope, themeId)) return null;

  const [allThemes, allIdeas, benefits, users] = await Promise.all([
    fetchThemes(),
    fetchIdeas(),
    fetchBenefits(),
    fetchUsers(),
  ]);
  const theme = allThemes.find((t) => t.id === themeId);
  if (!theme) return null;

  const themeIdeas = allIdeas.filter((i) => i.strategic_theme_id === themeId);
  const ideaIds = new Set(themeIdeas.map((i) => i.id));
  const financial = benefits.filter((b) => b.benefit_type === 'financial' && ideaIds.has(b.idea_id));
  const owner = users.find((u) => u.id === (theme as { owner_id?: string }).owner_id);

  return {
    theme: {
      id: theme.id,
      title_ar: theme.name_ar,
      title_en: theme.name_en,
      description: (theme as { description?: string }).description ?? '',
      owner: owner?.full_name ?? null,
    },
    kpis: {
      ideas: themeIdeas.length,
      budgetSpent: financial.reduce((s, b) => s + (b.realized_value ?? 0), 0),
      budgetAllocated: financial.reduce((s, b) => s + (b.target_value ?? 0), 0),
      pilotsActive: themeIdeas.filter((i) => Number(i.current_stage ?? 0) >= 6 && i.status !== 'closed').length,
      implementationsDone: themeIdeas.filter((i) => IMPLEMENTED_STATUSES.has(i.status)).length,
    },
    timeline: monthlySeries(themeIdeas, () => true, 12),
    ideas: themeIdeas
      .sort((a, b) => Number(b.current_stage ?? 0) - Number(a.current_stage ?? 0))
      .map((i) => ({
        id: i.id,
        code: i.code,
        title_ar: i.title_ar,
        title_en: i.title_en,
        status: i.status,
        current_stage: Number(i.current_stage ?? 0),
      })),
  };
}
