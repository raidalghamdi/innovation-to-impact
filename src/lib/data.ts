// Data access layer. Reads from Supabase when configured, otherwise falls
// back to the demo dataset so the app renders fully during build/preview.
//
// Every fetch logs Supabase errors to stderr so that PostgREST / RLS / schema
// misconfigurations surface in Vercel logs instead of being silently masked
// by the demo fallback.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import * as demo from '@/lib/demo-data';

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
