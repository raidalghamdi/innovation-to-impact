import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { EvaluatorQueuePreview } from '@/components/evaluator/evaluator-queue-preview';
import { getCurrentUser } from '@/lib/user';
import { getUserPoints } from '@/lib/gamification';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { resolveLevel } from '@/lib/evaluator-levels';
import { formatDate } from '@/lib/utils';
import { ClipboardCheck, CalendarCheck, Timer, Star } from 'lucide-react';

// Auth-gated, per-user dashboard — never meaningfully static.
export const dynamic = 'force-dynamic';

export default async function EvaluatorDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  const evaluatorId = user?.id ?? 'u2';
  const [dashboard, points] = await Promise.all([
    fetchEvaluatorDashboard(evaluatorId),
    getUserPoints(evaluatorId),
  ]);
  const level = resolveLevel(points.points);
  const levelName = isAr ? level.current.name_ar : level.current.name_en;

  // ── Evaluator KPIs (never innovator/platform metrics) ────────────────────
  const awaiting = Math.max(dashboard.totalAssigned - dashboard.completed, 0);

  const now = new Date();
  const evaluatedThisMonth = dashboard.queue.filter((q) => {
    if (!q.submitted_evaluation_at) return false;
    const d = new Date(q.submitted_evaluation_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const durations = dashboard.queue
    .filter((q) => q.submitted_evaluation_at && q.submitted_at)
    .map(
      (q) =>
        (new Date(q.submitted_evaluation_at as string).getTime() -
          new Date(q.submitted_at as string).getTime()) /
        86_400_000
    )
    .filter((d) => d >= 0);
  const avgDays = durations.length
    ? Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length))
    : null;

  // Queue preview — latest 5 ideas still awaiting this evaluator's score.
  // Round 27: this is a preview strip of the newest incoming ideas only.
  // The full searchable/filterable list lives at /evaluator/ideas (top tab).
  // Sorted newest-first so the "latest incoming" contract is truthful.
  const queuePreview = dashboard.queue
    .filter((q) => q.eval_status !== 'submitted')
    .sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
    .slice(0, 5)
    .map((q) => ({
      id: q.idea_id,
      title:
        (isAr ? q.title_ar : q.title_en) ||
        q.idea_code ||
        (isAr ? 'فكرة مجهولة الهوية' : 'Anonymous idea'),
      track: (isAr ? q.theme_ar : q.theme_en) || null,
      submitted: q.submitted_at ? formatDate(q.submitted_at, locale) : '—',
    }));

  const displayName = user?.fullName || user?.email || (isAr ? 'مقيّم' : 'Evaluator');

  // Round 27: each KPI card carries a value and an optional unit rendered in
  // the SAME typography as the value (no more mixed font/size like the old
  // 'يوم' label). All labels share one font-size/weight; all values share
  // another. See the render block below for the unified styling.
  const kpis = [
    { icon: ClipboardCheck, label: t('kpiAwaiting'), value: String(awaiting), unit: null, color: 'var(--gold)' },
    { icon: CalendarCheck, label: t('kpiEvaluatedMonth'), value: String(evaluatedThisMonth), unit: null, color: 'var(--sage)' },
    {
      icon: Timer,
      label: t('kpiAvgTime'),
      value: avgDays !== null ? String(avgDays) : '—',
      unit: avgDays !== null ? t('unitDay') : null,
      color: 'var(--cyan)',
    },
    { icon: Star, label: t('kpiPoints'), value: String(points.points), unit: null, color: 'var(--gold-deep)', hint: levelName },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Hero card */}
      <section className="rounded-[var(--radius-lg)] bg-[var(--ink)] p-6 text-white sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/60">
          {t('welcomeBack')}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
          {isAr ? `أهلاً بعودتك، ${displayName}` : `Welcome back, ${displayName}`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">{t('ctaBody')}</p>
        <Link href="/evaluator/ideas" className="ev-btn-gold mt-5 text-sm">
          {t('startEvaluating')}
        </Link>
      </section>

      {/* Evaluator KPIs — Round 27 unified visual hierarchy:
            • label is the primary line (uppercase, bolded, --ink-soft)
            • value + unit share one typography stack (font-display, text-3xl,
              tabular-nums) so the 'يوم' unit on the avg-time card no longer
              stands out from the rest
            • all cards use the same padding, gap, alignment */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="ev-card p-5">
              {/* Round 28 KPI hierarchy: label is the primary line — same
                  weight and size class as the number — so a glance reads
                  "what is this?" before "how much?". The number is dimmed
                  slightly (ink-soft) to keep it from dominating. The unit
                  ('يوم') inherits the same font-display + font-bold as
                  the number, only smaller, so the typography stays
                  consistent across all four cards. */}
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-base font-bold leading-snug text-[var(--ink)]">
                  {k.label}
                </p>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--paper)', color: k.color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="ev-num mt-3 flex items-baseline gap-1.5 font-display text-xl font-bold leading-none text-[var(--ink-soft)]">
                <span>{k.value}</span>
                {k.unit && <span className="font-display text-base font-bold text-[var(--ink-soft)]">{k.unit}</span>}
              </p>
              {'hint' in k && k.hint && (
                <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">{k.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Evaluation queue preview — latest incoming ideas. Full list lives
          on /evaluator/ideas (linked from the top nav and the empty-state
          CTA below). Kept intentionally short (5 items). */}
      <EvaluatorQueuePreview
        heading={t('queuePreviewTitle')}
        viewAllLabel={t('viewAll')}
        evaluateLabel={t('evaluate')}
        emptyLabel={t('queueEmptyShort')}
        emptyCtaLabel={t('viewFullQueue')}
        submittedOnLabel={t('submittedOn')}
        items={queuePreview}
      />
    </div>
  );
}
