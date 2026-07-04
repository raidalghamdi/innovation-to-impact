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

export type EvaluationSummary = {
  ideaId: string;
  count: number;
  avgTotal: number | null;
  perCriterion: Record<string, number>;
  conflicts: number;
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
    .select('idea_id, total_score, criteria_scores, conflict_of_interest, submitted_at')
    .in('idea_id', ideaIds)
    .not('submitted_at', 'is', null);
  logSupabaseError('fetchEvaluationSummaries', error);
  if (!data) return result;

  const acc: Record<
    string,
    { totals: number[]; criterion: Record<string, number[]>; conflicts: number; count: number }
  > = {};

  for (const row of data as Array<{
    idea_id: string;
    total_score: number | null;
    criteria_scores: Record<string, number> | null;
    conflict_of_interest: boolean | null;
  }>) {
    const bucket = (acc[row.idea_id] ??= {
      totals: [],
      criterion: {},
      conflicts: 0,
      count: 0,
    });
    bucket.count += 1;
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
