import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { EvaluatorRecentActivity } from '@/components/evaluator/evaluator-recent-activity';
import { getCurrentUser } from '@/lib/user';
import { getUserPoints } from '@/lib/gamification';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { resolveLevel } from '@/lib/evaluator-levels';
import { formatDate } from '@/lib/utils';
import { EvRing } from '@/components/evaluator/ev-ui';

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

  const remaining = dashboard.totalAssigned - dashboard.completed;

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

  const displayName = user?.fullName || user?.email || (isAr ? 'مقيّم' : 'Evaluator');

  return (
    <div className="space-y-8">
      {/* Head */}
      <div>
        <p className="ev-eyebrow">{t('welcomeBack')}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{displayName}</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('statRemaining')}
          ring={<EvRing value={remaining} max={dashboard.totalAssigned || 1} color="var(--gold)" label={String(remaining)} />}
        />
        <StatCard
          label={t('statCompleted')}
          ring={<EvRing value={dashboard.completed} max={dashboard.totalAssigned || 1} color="var(--sage)" label={String(dashboard.completed)} />}
        />
        <div className="ev-card p-5">
          <p className="text-sm font-medium text-[var(--ink-soft)]">{t('statLevel')}</p>
          <p className="mt-2 font-display text-lg font-bold text-[var(--ink)]">{levelName}</p>
          <div className="ev-progress mt-3">
            <span style={{ width: `${level.progressPct}%` }} />
          </div>
          <p className="ev-num mt-2 text-xs text-[var(--ink-faint)]">{points.points} {t('points')}</p>
        </div>
      </div>

      {/* Banner CTA */}
      <div className="rounded-[var(--radius-lg)] bg-[var(--ink)] p-6 text-white sm:p-8">
        <h2 className="font-display text-xl font-bold">{t('ctaTitle')}</h2>
        <p className="mt-2 max-w-xl text-sm text-white/70">{t('ctaBody')}</p>
        <Link href="/evaluator/ideas" className="ev-btn-gold mt-4 text-sm">
          {t('ctaButton')}
        </Link>
      </div>

      {/* Recent activity */}
      <EvaluatorRecentActivity
        heading={t('recentActivity')}
        emptyTitle={t('noActivityTitle')}
        emptyHint={t('noActivityHint')}
        submittedLabel={t('activitySubmitted')}
        items={activity}
      />
    </div>
  );
}

function StatCard({ label, ring }: { label: string; ring: React.ReactNode }) {
  return (
    <div className="ev-card flex items-center gap-4 p-5">
      {ring}
      <p className="text-sm font-medium text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}
