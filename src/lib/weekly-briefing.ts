import { createAdminClient } from '@/lib/supabase/admin';
import { sendBilingualEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';

// Weekly admin activity digest (Cross-cutting F3). Extracted from the
// /api/cron/weekly-briefing route module because Next.js route handlers may
// only export the HTTP-method functions (GET/POST/...) plus a small allowlist
// of config fields — any other export fails the build ("not a valid Route
// export field"). This module holds all the actual logic + types; the route
// file (and sla-reminders, which piggybacks on it for Hobby-plan cron limits)
// just import from here.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://innovation-to-impact.vercel.app';

type StatusCount = { status: string; count: number };

export type WeeklyBriefingMetrics = {
  windowStart: string;
  windowEnd: string;
  newIdeasCount: number;
  ideasByStatus: StatusCount[];
  evaluationsCompleted: number;
  committeeDecisions: number;
  openEscalations: number;
  overdueEvaluations: number;
  topIdeas: { ideaId: string; title: string; avgScore: number; evaluationCount: number }[];
};

async function gatherMetrics(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<WeeklyBriefingMetrics> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowStartIso = windowStart.toISOString();
  const nowIso = now.toISOString();

  // New ideas in window + status breakdown (breakdown is platform-wide status
  // mix, not window-scoped, since 'status' reflects current state not a
  // point-in-time event).
  const { data: newIdeas, error: ideasErr } = await supabase
    .from('ideas')
    .select('id, status')
    .gte('created_at', windowStartIso);
  if (ideasErr) console.error('[weekly-briefing] ideas query error:', ideasErr);

  const { data: allIdeas, error: allIdeasErr } = await supabase.from('ideas').select('status');
  if (allIdeasErr) console.error('[weekly-briefing] ideas status query error:', allIdeasErr);

  const statusCounts = new Map<string, number>();
  for (const row of (allIdeas as { status: string | null }[] | null) ?? []) {
    const status = row.status ?? 'unknown';
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const ideasByStatus: StatusCount[] = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Evaluations completed in window: submitted_at is the completion stamp
  // (see saveEvaluation in evaluation/actions.ts) — there's no separate
  // `status` column on innovation.evaluations.
  const { count: evaluationsCompleted, error: evalErr } = await supabase
    .from('evaluations')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', windowStartIso)
    .not('submitted_at', 'is', null);
  if (evalErr) console.error('[weekly-briefing] evaluations query error:', evalErr);

  // Committee decisions in window.
  const { count: committeeDecisions, error: cdErr } = await supabase
    .from('committee_decisions')
    .select('id', { count: 'exact', head: true })
    .gte('decided_at', windowStartIso);
  if (cdErr) console.error('[weekly-briefing] committee_decisions query error:', cdErr);

  // Open escalations (current snapshot, not window-scoped).
  const { count: openEscalations, error: escErr } = await supabase
    .from('escalations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  if (escErr) console.error('[weekly-briefing] escalations query error:', escErr);

  // Overdue evaluations: pending assignments whose due_at has passed.
  // innovation.assignments.status already tracks 'pending' | 'completed' |
  // 'declined' (see 00010_assignments_reconcile.sql), so "no completed
  // evaluation" is simply status = 'pending' rather than a join.
  const { count: overdueEvaluations, error: assignErr } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('due_at', nowIso);
  if (assignErr) console.error('[weekly-briefing] assignments query error:', assignErr);

  // Top 5 ideas by aggregate (average) evaluation score. No dedicated
  // leaderboard/aggregate-score view exists for ideas (innovation.v_leaderboard
  // is the *gamification* points leaderboard, unrelated) so this is computed
  // here from innovation.evaluations + innovation.ideas.
  const { data: scoreRows, error: scoreErr } = await supabase
    .from('evaluations')
    .select('idea_id, total_score')
    .not('total_score', 'is', null);
  if (scoreErr) console.error('[weekly-briefing] scores query error:', scoreErr);

  const byIdea = new Map<string, { sum: number; n: number }>();
  for (const row of (scoreRows as { idea_id: string; total_score: number }[] | null) ?? []) {
    const entry = byIdea.get(row.idea_id) ?? { sum: 0, n: 0 };
    entry.sum += Number(row.total_score);
    entry.n += 1;
    byIdea.set(row.idea_id, entry);
  }
  const ranked = Array.from(byIdea.entries())
    .map(([ideaId, { sum, n }]) => ({ ideaId, avgScore: sum / n, evaluationCount: n }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  let topIdeas: WeeklyBriefingMetrics['topIdeas'] = [];
  if (ranked.length > 0) {
    const { data: titleRows, error: titleErr } = await supabase
      .from('ideas')
      .select('id, title_en, title_ar')
      .in('id', ranked.map((r) => r.ideaId));
    if (titleErr) console.error('[weekly-briefing] idea titles query error:', titleErr);
    const titleMap = new Map(
      ((titleRows as { id: string; title_en: string | null; title_ar: string | null }[]) ?? []).map(
        (r) => [r.id, r.title_en || r.title_ar || r.id]
      )
    );
    topIdeas = ranked.map((r) => ({
      ideaId: r.ideaId,
      title: titleMap.get(r.ideaId) ?? r.ideaId,
      avgScore: Number(r.avgScore.toFixed(2)),
      evaluationCount: r.evaluationCount,
    }));
  }

  return {
    windowStart: windowStartIso,
    windowEnd: nowIso,
    newIdeasCount: (newIdeas as { id: string }[] | null)?.length ?? 0,
    ideasByStatus,
    evaluationsCompleted: evaluationsCompleted ?? 0,
    committeeDecisions: committeeDecisions ?? 0,
    openEscalations: openEscalations ?? 0,
    overdueEvaluations: overdueEvaluations ?? 0,
    topIdeas,
  };
}

function renderMetricsHtml(metrics: WeeklyBriefingMetrics, locale: 'en' | 'ar'): string {
  const isAr = locale === 'ar';
  const statusRows = metrics.ideasByStatus
    .map((s) => `<li>${s.status}: <strong>${s.count}</strong></li>`)
    .join('');
  const topIdeaRows = metrics.topIdeas.length
    ? metrics.topIdeas
        .map(
          (i, idx) =>
            `<li>#${idx + 1} — ${i.title} (${isAr ? 'المتوسط' : 'avg'} ${i.avgScore}, ${i.evaluationCount} ${isAr ? 'تقييم' : 'evals'})</li>`
        )
        .join('')
    : `<li>${isAr ? 'لا توجد بيانات تقييم كافية بعد.' : 'No scored evaluations yet.'}</li>`;
  const link = `${SITE_URL}/${locale}/admin/analytics`;

  if (isAr) {
    return `
      <p>الفترة: من ${metrics.windowStart.slice(0, 10)} إلى ${metrics.windowEnd.slice(0, 10)}</p>
      <ul>
        <li>أفكار جديدة: <strong>${metrics.newIdeasCount}</strong></li>
        <li>تقييمات مكتملة: <strong>${metrics.evaluationsCompleted}</strong></li>
        <li>قرارات اللجنة: <strong>${metrics.committeeDecisions}</strong></li>
        <li>تصعيدات مفتوحة: <strong>${metrics.openEscalations}</strong></li>
        <li>تقييمات متأخرة: <strong>${metrics.overdueEvaluations}</strong></li>
      </ul>
      <p><strong>الأفكار حسب الحالة:</strong></p>
      <ul>${statusRows}</ul>
      <p><strong>أفضل 5 أفكار حسب متوسط الدرجات:</strong></p>
      <ul>${topIdeaRows}</ul>
      <p><a href="${link}" style="color:#01696F;">فتح لوحة التحليلات</a></p>`;
  }

  return `
    <p>Window: ${metrics.windowStart.slice(0, 10)} to ${metrics.windowEnd.slice(0, 10)}</p>
    <ul>
      <li>New ideas: <strong>${metrics.newIdeasCount}</strong></li>
      <li>Evaluations completed: <strong>${metrics.evaluationsCompleted}</strong></li>
      <li>Committee decisions: <strong>${metrics.committeeDecisions}</strong></li>
      <li>Open escalations: <strong>${metrics.openEscalations}</strong></li>
      <li>Overdue evaluations: <strong>${metrics.overdueEvaluations}</strong></li>
    </ul>
    <p><strong>Ideas by status:</strong></p>
    <ul>${statusRows}</ul>
    <p><strong>Top 5 ideas by average score:</strong></p>
    <ul>${topIdeaRows}</ul>
    <p><a href="${link}" style="color:#01696F;">Open the analytics dashboard</a></p>`;
}

async function runWeeklyBriefing(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<{ recipients: number; metrics: WeeklyBriefingMetrics }> {
  const metrics = await gatherMetrics(supabase);

  const { data: admins, error: adminsErr } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('role', 'admin')
    .not('email', 'is', null);
  if (adminsErr) console.error('[weekly-briefing] admins query error:', adminsErr);

  const recipients = ((admins as { email: string | null }[] | null) ?? [])
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));

  if (recipients.length > 0) {
    await sendBilingualEmail({
      to: recipients,
      subject: 'Weekly Innovation Briefing / الملخص الأسبوعي للابتكار',
      titleEn: 'Weekly Innovation Briefing',
      bodyHtmlEn: renderMetricsHtml(metrics, 'en'),
      titleAr: 'الملخص الأسبوعي للابتكار',
      bodyHtmlAr: renderMetricsHtml(metrics, 'ar'),
    });
  }

  await logAudit(null, 'briefing.weekly_sent', 'weekly_briefing', null, {
    after: {
      recipients: recipients.length,
      metrics,
    },
    client: supabase,
  });

  return { recipients: recipients.length, metrics };
}

// Exported so /api/cron/sla-reminders (the single Hobby-plan-safe daily cron)
// can trigger the weekly briefing in-process on Mondays without Vercel needing
// a second scheduled invocation. See vercel.json — there is intentionally only
// one cron entry. The /api/cron/weekly-briefing route also calls this
// directly for manual testing/verification (?force=true).
export async function maybeRunWeeklyBriefing(opts: { force?: boolean } = {}): Promise<{
  ran: boolean;
  recipients?: number;
  metrics?: WeeklyBriefingMetrics;
}> {
  const isMonday = new Date().getUTCDay() === 1;
  if (!isMonday && !opts.force) return { ran: false };

  const supabase = createAdminClient();
  if (!supabase) return { ran: false };

  try {
    const { recipients, metrics } = await runWeeklyBriefing(supabase);
    return { ran: true, recipients, metrics };
  } catch (err) {
    console.error('[weekly-briefing] failed:', err);
    return { ran: false };
  }
}
