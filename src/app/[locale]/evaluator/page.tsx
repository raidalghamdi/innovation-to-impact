import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { EvaluatorRecentActivity } from '@/components/evaluator/evaluator-recent-activity';
import { EvaluatorQueuePreview } from '@/components/evaluator/evaluator-queue-preview';
import { EvaluatorNotificationsPreview } from '@/components/evaluator/evaluator-notifications-preview';
import { getCurrentUser } from '@/lib/user';
import { getUserPoints } from '@/lib/gamification';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { resolveLevel } from '@/lib/evaluator-levels';
import { formatDate } from '@/lib/utils';
import {
  ListChecks,
  Bell,
  Trophy,
  History,
  Settings,
  ClipboardCheck,
  CalendarCheck,
  Timer,
  Star,
} from 'lucide-react';

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

  // Recent activity — derived from real evaluation submissions in the queue.
  const activity = dashboard.queue
    .filter((q) => q.submitted_evaluation_at)
    .sort((a, b) =>
      (b.submitted_evaluation_at ?? '').localeCompare(a.submitted_evaluation_at ?? '')
    )
    .slice(0, 6)
    .map((q) => ({
      id: q.idea_id,
      title: (isAr ? q.title_ar : q.title_en) || q.idea_code || '—',
      when: q.submitted_evaluation_at ? formatDate(q.submitted_evaluation_at, locale) : '',
    }));

  // Queue preview — first 5 ideas still awaiting this evaluator's score.
  const queuePreview = dashboard.queue
    .filter((q) => q.eval_status !== 'submitted')
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

  const quickActions = [
    { icon: ListChecks, title: t('qaEvaluate'), sub: t('qaEvaluateSub'), href: '/evaluator/ideas' },
    { icon: Bell, title: t('qaNotifications'), sub: t('qaNotificationsSub'), href: '/evaluator/notifications' },
    { icon: Trophy, title: t('qaLevel'), sub: t('qaLevelSub'), href: '/evaluator/level' },
    { icon: History, title: t('qaMyEvals'), sub: t('qaMyEvalsSub'), href: '/evaluator/my-evaluations' },
    { icon: Settings, title: t('qaSettings'), sub: t('qaSettingsSub'), href: '/evaluator/settings' },
  ] as const;

  const kpis = [
    { icon: ClipboardCheck, label: t('kpiAwaiting'), value: String(awaiting), color: 'var(--gold)' },
    { icon: CalendarCheck, label: t('kpiEvaluatedMonth'), value: String(evaluatedThisMonth), color: 'var(--sage)' },
    {
      icon: Timer,
      label: t('kpiAvgTime'),
      value: avgDays ? `${avgDays} ${t('unitDay')}` : '—',
      color: 'var(--cyan)',
    },
    { icon: Star, label: t('kpiPoints'), value: String(points.points), color: 'var(--gold-deep)', hint: levelName },
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

      {/* Evaluator KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="ev-card p-5">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)]"
                style={{ background: 'var(--paper)', color: k.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="ev-num mt-3 text-2xl font-bold text-[var(--ink)]">{k.value}</p>
              <p className="mt-1 text-xs font-medium text-[var(--ink-soft)]">{k.label}</p>
              {'hint' in k && k.hint && (
                <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{k.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions — evaluator-only */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-[var(--ink)]">
          {t('quickActionsTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <Link
                key={qa.href}
                href={qa.href as any}
                className="ev-idea-card flex items-center gap-4 p-4"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--ink)]">{qa.title}</span>
                  <span className="block text-xs text-[var(--ink-faint)]">{qa.sub}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Evaluation queue preview */}
      <EvaluatorQueuePreview
        heading={t('queuePreviewTitle')}
        viewAllLabel={t('viewAll')}
        evaluateLabel={t('evaluate')}
        emptyLabel={t('queueEmptyShort')}
        emptyCtaLabel={t('viewFullQueue')}
        submittedOnLabel={t('submittedOn')}
        items={queuePreview}
      />

      {/* Two-column: recent notifications + recent activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <EvaluatorNotificationsPreview
          locale={locale}
          heading={t('recentNotifications')}
          viewAllLabel={t('viewAll')}
          emptyLabel={t('notificationsEmptyShort')}
        />
        <EvaluatorRecentActivity
          heading={t('recentActivity')}
          emptyTitle={t('noActivityTitle')}
          emptyHint={t('noActivityHint')}
          submittedLabel={t('activitySubmitted')}
          items={activity}
        />
      </div>
    </div>
  );
}
