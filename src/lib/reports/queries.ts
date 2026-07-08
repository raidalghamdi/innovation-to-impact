// One query function per report type. Each returns a normalized `ReportBundle`
// so the renderers (PDF/XLSX/PPTX) don't need to know the domain — they just
// see KPIs + tabular sections.
//
// Data sources:
//   - `gatherIdeasDataset` for anything that starts from the ideas graph
//   - direct Supabase reads for tables not covered by the exports dataset
//     (audit_logs, evaluations, committee_decisions, notifications, sla_tracking)
//   - graceful degradation: if Supabase is not configured, every report still
//     returns the KPIs it can compute from the demo dataset, so the API never
//     500s in dev.
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { gatherIdeasDataset, themeName, userName } from '@/lib/exports/dataset';
import type { ReportBundle, ReportRequest, ReportSection, ReportKpi } from './types';

function makeBundle(
  req: ReportRequest,
  generatedBy: string,
  kpis: ReportKpi[],
  sections: ReportSection[]
): ReportBundle {
  const totalRowCount = sections.reduce((acc, s) => acc + s.rows.length, 0);
  return {
    type: req.type,
    generatedAt: new Date().toISOString(),
    generatedBy,
    dateFrom: req.from ?? null,
    dateTo: req.to ?? null,
    kpis,
    sections,
    totalRowCount,
  };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

// ────────────────────────────────────────────────────────────────────────────
// Executive report — highest-level KPIs only.
async function buildExecutive(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to, themeId: req.themeId });
  const total = ds.ideas.length;
  const approved = ds.ideas.filter((i) => ['approved', 'in_implementation', 'in_pilot', 'benefits_tracking', 'scaling'].includes(i.status)).length;
  const rejected = ds.ideas.filter((i) => i.status === 'rejected').length;
  const inProgress = ds.ideas.filter((i) => ['screening', 'evaluation', 'committee', 'assigned'].includes(i.status)).length;
  const implemented = ds.ideas.filter((i) => ['in_pilot', 'benefits_tracking', 'scaling'].includes(i.status)).length;

  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي الأفكار', label_en: 'Total Ideas', value: String(total) },
    { label_ar: 'أفكار مُعتمدة', label_en: 'Approved', value: String(approved) },
    { label_ar: 'أفكار مرفوضة', label_en: 'Rejected', value: String(rejected) },
    { label_ar: 'قيد المعالجة', label_en: 'In Progress', value: String(inProgress) },
    { label_ar: 'أفكار مُنفّذة', label_en: 'Implemented', value: String(implemented) },
    { label_ar: 'معدل الاعتماد', label_en: 'Approval Rate', value: pct(approved, total) },
  ];

  const byTheme = new Map<string, number>();
  for (const idea of ds.ideas) {
    const t = ds.themeById.get(idea.strategic_theme_id ?? '');
    const label = themeName(t, 'en') || 'Unassigned';
    byTheme.set(label, (byTheme.get(label) ?? 0) + 1);
  }
  const themeSection: ReportSection = {
    title_ar: 'التوزيع حسب المسار الاستراتيجي',
    title_en: 'Distribution by Strategic Theme',
    columns: [
      { key: 'theme', label_ar: 'المسار', label_en: 'Theme', width: 40 },
      { key: 'count', label_ar: 'العدد', label_en: 'Count', width: 12 },
      { key: 'pct', label_ar: 'النسبة', label_en: 'Share', width: 12 },
    ],
    rows: [...byTheme.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([theme, count]) => ({ theme, count, pct: pct(count, total) })),
  };

  return makeBundle(req, generatedBy, kpis, [themeSection]);
}

// ────────────────────────────────────────────────────────────────────────────
// Detailed report — full idea-level listing.
async function buildDetailed(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to, themeId: req.themeId });
  const rows = ds.ideas.map((i) => ({
    code: i.code ?? '',
    title: i.title_en || i.title_ar || '',
    status: i.status,
    theme: themeName(ds.themeById.get(i.strategic_theme_id ?? ''), 'en'),
    submitter: userName(ds.userById.get(i.submitter_id ?? '')),
    created_at: fmtDate(i.created_at),
    stage: (i as unknown as { current_stage?: number }).current_stage ?? '',
  }));
  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي الصفوف', label_en: 'Total Rows', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'قائمة الأفكار الكاملة',
    title_en: 'Full Ideas Listing',
    columns: [
      { key: 'code', label_ar: 'الكود', label_en: 'Code', width: 14 },
      { key: 'title', label_ar: 'العنوان', label_en: 'Title', width: 46 },
      { key: 'status', label_ar: 'الحالة', label_en: 'Status', width: 16 },
      { key: 'theme', label_ar: 'المسار', label_en: 'Theme', width: 24 },
      { key: 'submitter', label_ar: 'المُقدِّم', label_en: 'Submitter', width: 22 },
      { key: 'stage', label_ar: 'المرحلة', label_en: 'Stage', width: 8 },
      { key: 'created_at', label_ar: 'تاريخ الإنشاء', label_en: 'Created', width: 12 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Media report — highlight stories: approved + implemented ideas.
async function buildMedia(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to, themeId: req.themeId });
  const highlights = ds.ideas.filter((i) => ['approved', 'in_pilot', 'benefits_tracking', 'scaling'].includes(i.status));
  const publicOnly = highlights.filter((i) => (i as unknown as { confidentiality?: string }).confidentiality === 'public');

  const kpis: ReportKpi[] = [
    { label_ar: 'قصص بارزة', label_en: 'Highlight Stories', value: String(highlights.length) },
    { label_ar: 'أفكار عامة', label_en: 'Public Ideas', value: String(publicOnly.length) },
    { label_ar: 'قابلة للنشر', label_en: 'Publishable', value: String(publicOnly.length) },
  ];
  const section: ReportSection = {
    title_ar: 'قصص جاهزة للنشر',
    title_en: 'Publication-Ready Stories',
    columns: [
      { key: 'title', label_ar: 'العنوان', label_en: 'Title', width: 44 },
      { key: 'benefit', label_ar: 'الأثر المتوقع', label_en: 'Expected Benefit', width: 40 },
      { key: 'stage', label_ar: 'الحالة', label_en: 'Stage', width: 16 },
      { key: 'theme', label_ar: 'المسار', label_en: 'Theme', width: 20 },
    ],
    rows: publicOnly.map((i) => ({
      title: i.title_en || i.title_ar,
      benefit: (i as unknown as { expected_benefits?: string }).expected_benefits ?? '',
      stage: i.status,
      theme: themeName(ds.themeById.get(i.strategic_theme_id ?? ''), 'en'),
    })),
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// CX report — innovator/user satisfaction signals derived from idea_feedback + support_messages.
async function buildCx(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const returned = ds.ideas.filter((i) => i.status === 'returned').length;
  const feedbackRows: Record<string, string | number | null>[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let query = supabase.from('idea_feedback').select('id, idea_id, content, created_at, author_id').limit(500);
      if (req.from) query = query.gte('created_at', `${req.from}T00:00:00Z`);
      if (req.to) query = query.lte('created_at', `${req.to}T23:59:59Z`);
      const { data } = await query;
      for (const r of (data as { idea_id: string; content: string | null; created_at: string }[] | null) ?? []) {
        feedbackRows.push({
          idea: r.idea_id,
          feedback: r.content ?? '',
          created_at: fmtDate(r.created_at),
        });
      }
    }
  }

  const kpis: ReportKpi[] = [
    { label_ar: 'أفكار مُعادة للمبتكر', label_en: 'Ideas Returned to Innovator', value: String(returned) },
    { label_ar: 'ملاحظات مُستلمة', label_en: 'Feedback Entries', value: String(feedbackRows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'الملاحظات والتفاعلات',
    title_en: 'Feedback and Interactions',
    columns: [
      { key: 'idea', label_ar: 'الفكرة', label_en: 'Idea', width: 22 },
      { key: 'feedback', label_ar: 'الملاحظة', label_en: 'Feedback', width: 60 },
      { key: 'created_at', label_ar: 'التاريخ', label_en: 'Date', width: 14 },
    ],
    rows: feedbackRows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Operational report — SLA + queue health.
async function buildOperational(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const pending = ds.ideas.filter((i) => ['screening', 'evaluation', 'committee', 'assigned'].includes(i.status)).length;

  const rows: Record<string, string | number | null>[] = [];
  let slaBreaches = 0;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('sla_tracking').select('id, entity_type, entity_id, sla_type, due_at, status, breached_at').limit(500);
      if (req.from) q = q.gte('due_at', `${req.from}T00:00:00Z`);
      if (req.to) q = q.lte('due_at', `${req.to}T23:59:59Z`);
      const { data } = await q;
      for (const r of (data as Record<string, string | null>[] | null) ?? []) {
        rows.push({
          entity: `${r.entity_type ?? ''} ${r.entity_id ?? ''}`.trim(),
          sla_type: r.sla_type ?? '',
          due_at: fmtDate(r.due_at),
          status: r.status ?? '',
          breached_at: fmtDate(r.breached_at),
        });
        if (r.breached_at) slaBreaches += 1;
      }
    }
  }

  const kpis: ReportKpi[] = [
    { label_ar: 'أفكار في الطوابير', label_en: 'Ideas In Queue', value: String(pending) },
    { label_ar: 'خروقات اتفاقيات الخدمة', label_en: 'SLA Breaches', value: String(slaBreaches) },
    { label_ar: 'إجمالي سجلات الخدمة', label_en: 'SLA Records', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'حالة اتفاقيات الخدمة',
    title_en: 'SLA Health',
    columns: [
      { key: 'entity', label_ar: 'الكيان', label_en: 'Entity', width: 32 },
      { key: 'sla_type', label_ar: 'نوع الخدمة', label_en: 'SLA Type', width: 20 },
      { key: 'due_at', label_ar: 'المستحقة في', label_en: 'Due', width: 14 },
      { key: 'status', label_ar: 'الحالة', label_en: 'Status', width: 14 },
      { key: 'breached_at', label_ar: 'تاريخ الخرق', label_en: 'Breached At', width: 14 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Audit — audit_logs feed.
async function buildAudit(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const rows: Record<string, string | number | null>[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('audit_logs').select('id, actor_id, entity_type, entity_id, action, meta, created_at').order('created_at', { ascending: false }).limit(1000);
      if (req.from) q = q.gte('created_at', `${req.from}T00:00:00Z`);
      if (req.to) q = q.lte('created_at', `${req.to}T23:59:59Z`);
      const { data } = await q;
      for (const r of (data as Record<string, unknown>[] | null) ?? []) {
        rows.push({
          actor_id: String(r.actor_id ?? ''),
          entity_type: String(r.entity_type ?? ''),
          entity_id: String(r.entity_id ?? ''),
          action: String(r.action ?? ''),
          created_at: fmtDate(String(r.created_at ?? '')),
        });
      }
    }
  }
  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي السجلات', label_en: 'Total Records', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'سجل المراجعة',
    title_en: 'Audit Trail',
    columns: [
      { key: 'created_at', label_ar: 'التاريخ', label_en: 'Date', width: 14 },
      { key: 'actor_id', label_ar: 'الفاعل', label_en: 'Actor', width: 28 },
      { key: 'entity_type', label_ar: 'نوع الكيان', label_en: 'Entity Type', width: 18 },
      { key: 'entity_id', label_ar: 'معرّف الكيان', label_en: 'Entity ID', width: 28 },
      { key: 'action', label_ar: 'الفعل', label_en: 'Action', width: 22 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Ideas report — every idea with core fields.
async function buildIdeas(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  return buildDetailed(req, generatedBy);
}

// ────────────────────────────────────────────────────────────────────────────
// Evaluators — evaluator scorecard.
async function buildEvaluators(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const rows: Record<string, string | number | null>[] = [];
  let totalEvals = 0;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('evaluations').select('id, evaluator_id, idea_id, total_score, status, submitted_at, created_at').limit(2000);
      if (req.from) q = q.gte('created_at', `${req.from}T00:00:00Z`);
      if (req.to) q = q.lte('created_at', `${req.to}T23:59:59Z`);
      const { data } = await q;
      const byEval = new Map<string, { count: number; sum: number; submitted: number }>();
      for (const r of (data as { evaluator_id: string; total_score: number | null; status: string | null }[] | null) ?? []) {
        const entry = byEval.get(r.evaluator_id) ?? { count: 0, sum: 0, submitted: 0 };
        entry.count += 1;
        entry.sum += Number(r.total_score ?? 0);
        if (r.status === 'submitted') entry.submitted += 1;
        byEval.set(r.evaluator_id, entry);
        totalEvals += 1;
      }
      for (const [evId, agg] of byEval.entries()) {
        rows.push({
          evaluator: userName(ds.userById.get(evId)) || evId,
          evaluations: agg.count,
          submitted: agg.submitted,
          avg_score: agg.count ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
        });
      }
      rows.sort((a, b) => Number(b.evaluations) - Number(a.evaluations));
    }
  }

  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي التقييمات', label_en: 'Total Evaluations', value: String(totalEvals) },
    { label_ar: 'المُقيّمون النشطون', label_en: 'Active Evaluators', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'أداء المُقيّمين',
    title_en: 'Evaluator Performance',
    columns: [
      { key: 'evaluator', label_ar: 'المُقيّم', label_en: 'Evaluator', width: 32 },
      { key: 'evaluations', label_ar: 'عدد التقييمات', label_en: 'Evaluations', width: 16 },
      { key: 'submitted', label_ar: 'مُقدّمة', label_en: 'Submitted', width: 14 },
      { key: 'avg_score', label_ar: 'متوسط الدرجة', label_en: 'Avg Score', width: 16 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Themes — per strategic theme.
async function buildThemes(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const byTheme = new Map<
    string,
    { count: number; approved: number; rejected: number; label: string }
  >();
  for (const idea of ds.ideas) {
    const t = ds.themeById.get(idea.strategic_theme_id ?? '');
    const label = themeName(t, 'en') || 'Unassigned';
    const bucket = byTheme.get(label) ?? { count: 0, approved: 0, rejected: 0, label };
    bucket.count += 1;
    if (['approved', 'in_pilot', 'benefits_tracking', 'scaling'].includes(idea.status)) bucket.approved += 1;
    if (idea.status === 'rejected') bucket.rejected += 1;
    byTheme.set(label, bucket);
  }
  const rows = [...byTheme.values()]
    .sort((a, b) => b.count - a.count)
    .map((b) => ({
      theme: b.label,
      count: b.count,
      approved: b.approved,
      rejected: b.rejected,
      approval_rate: pct(b.approved, b.count),
    }));
  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي المسارات', label_en: 'Themes', value: String(rows.length) },
    { label_ar: 'إجمالي الأفكار', label_en: 'Total Ideas', value: String(ds.ideas.length) },
  ];
  const section: ReportSection = {
    title_ar: 'أداء المسارات',
    title_en: 'Themes Performance',
    columns: [
      { key: 'theme', label_ar: 'المسار', label_en: 'Theme', width: 36 },
      { key: 'count', label_ar: 'عدد الأفكار', label_en: 'Ideas', width: 14 },
      { key: 'approved', label_ar: 'مُعتمدة', label_en: 'Approved', width: 14 },
      { key: 'rejected', label_ar: 'مرفوضة', label_en: 'Rejected', width: 14 },
      { key: 'approval_rate', label_ar: 'معدل الاعتماد', label_en: 'Approval Rate', width: 18 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Innovators — top contributors.
async function buildInnovators(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const byUser = new Map<string, { name: string; count: number; approved: number }>();
  for (const idea of ds.ideas) {
    const uid = idea.submitter_id ?? '';
    if (!uid) continue;
    const name = userName(ds.userById.get(uid)) || uid;
    const b = byUser.get(uid) ?? { name, count: 0, approved: 0 };
    b.count += 1;
    if (['approved', 'in_pilot', 'benefits_tracking', 'scaling'].includes(idea.status)) b.approved += 1;
    byUser.set(uid, b);
  }
  const rows = [...byUser.values()]
    .sort((a, b) => b.count - a.count)
    .map((b) => ({ innovator: b.name, ideas: b.count, approved: b.approved }));
  const kpis: ReportKpi[] = [
    { label_ar: 'المبتكرون النشطون', label_en: 'Active Innovators', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'قائمة المبتكرين',
    title_en: 'Innovators Roster',
    columns: [
      { key: 'innovator', label_ar: 'المبتكر', label_en: 'Innovator', width: 34 },
      { key: 'ideas', label_ar: 'عدد الأفكار', label_en: 'Ideas', width: 14 },
      { key: 'approved', label_ar: 'مُعتمدة', label_en: 'Approved', width: 14 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Committee — committee_decisions.
async function buildCommittee(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const rows: Record<string, string | number | null>[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      let q = supabase.from('committee_decisions').select('id, idea_id, committee_name, decision, quorum_met, comments, decided_at').order('decided_at', { ascending: false }).limit(1000);
      if (req.from) q = q.gte('decided_at', `${req.from}T00:00:00Z`);
      if (req.to) q = q.lte('decided_at', `${req.to}T23:59:59Z`);
      const { data } = await q;
      for (const r of (data as Record<string, unknown>[] | null) ?? []) {
        rows.push({
          idea_id: String(r.idea_id ?? ''),
          committee_name: String(r.committee_name ?? ''),
          decision: String(r.decision ?? ''),
          quorum_met: r.quorum_met ? 'Yes' : 'No',
          decided_at: fmtDate(String(r.decided_at ?? '')),
        });
      }
    }
  }
  const kpis: ReportKpi[] = [
    { label_ar: 'إجمالي القرارات', label_en: 'Total Decisions', value: String(rows.length) },
  ];
  const section: ReportSection = {
    title_ar: 'قرارات اللجنة',
    title_en: 'Committee Decisions',
    columns: [
      { key: 'decided_at', label_ar: 'التاريخ', label_en: 'Date', width: 14 },
      { key: 'committee_name', label_ar: 'اللجنة', label_en: 'Committee', width: 24 },
      { key: 'idea_id', label_ar: 'الفكرة', label_en: 'Idea', width: 24 },
      { key: 'decision', label_ar: 'القرار', label_en: 'Decision', width: 18 },
      { key: 'quorum_met', label_ar: 'اكتمل النصاب', label_en: 'Quorum', width: 14 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// ────────────────────────────────────────────────────────────────────────────
// Trends — monthly time-series over the ideas dataset.
async function buildTrends(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  const ds = await gatherIdeasDataset({ from: req.from, to: req.to });
  const byMonth = new Map<string, { total: number; approved: number }>();
  for (const idea of ds.ideas) {
    const m = (idea.created_at ?? '').slice(0, 7);
    if (!m) continue;
    const b = byMonth.get(m) ?? { total: 0, approved: 0 };
    b.total += 1;
    if (['approved', 'in_pilot', 'benefits_tracking', 'scaling'].includes(idea.status)) b.approved += 1;
    byMonth.set(m, b);
  }
  const rows = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      ideas_submitted: b.total,
      approved: b.approved,
      approval_rate: pct(b.approved, b.total),
    }));
  const kpis: ReportKpi[] = [
    { label_ar: 'عدد الأشهر', label_en: 'Months Covered', value: String(rows.length) },
    { label_ar: 'إجمالي الأفكار', label_en: 'Total Ideas', value: String(ds.ideas.length) },
  ];
  const section: ReportSection = {
    title_ar: 'الاتجاه الشهري',
    title_en: 'Monthly Trend',
    columns: [
      { key: 'month', label_ar: 'الشهر', label_en: 'Month', width: 14 },
      { key: 'ideas_submitted', label_ar: 'أفكار مُقدَّمة', label_en: 'Submitted', width: 16 },
      { key: 'approved', label_ar: 'مُعتمدة', label_en: 'Approved', width: 14 },
      { key: 'approval_rate', label_ar: 'معدل الاعتماد', label_en: 'Approval Rate', width: 18 },
    ],
    rows,
  };
  return makeBundle(req, generatedBy, kpis, [section]);
}

// Dispatcher.
export async function buildReport(req: ReportRequest, generatedBy: string): Promise<ReportBundle> {
  switch (req.type) {
    case 'executive':
      return buildExecutive(req, generatedBy);
    case 'detailed':
      return buildDetailed(req, generatedBy);
    case 'media':
      return buildMedia(req, generatedBy);
    case 'cx':
      return buildCx(req, generatedBy);
    case 'operational':
      return buildOperational(req, generatedBy);
    case 'audit':
      return buildAudit(req, generatedBy);
    case 'ideas':
      return buildIdeas(req, generatedBy);
    case 'evaluators':
      return buildEvaluators(req, generatedBy);
    case 'themes':
      return buildThemes(req, generatedBy);
    case 'innovators':
      return buildInnovators(req, generatedBy);
    case 'committee':
      return buildCommittee(req, generatedBy);
    case 'trends':
      return buildTrends(req, generatedBy);
    default: {
      const _exhaustive: never = req.type;
      throw new Error(`Unknown report type: ${_exhaustive}`);
    }
  }
}
