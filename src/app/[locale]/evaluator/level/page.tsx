import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { getUserPoints } from '@/lib/gamification';
import { EV_LEVELS, resolveLevel } from '@/lib/evaluator-levels';

export default async function EvaluatorLevelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  const points = await getUserPoints(user?.id ?? 'u2');
  const { current, next, progressPct } = resolveLevel(points.points);

  const name = (l: (typeof EV_LEVELS)[number]) => (isAr ? l.name_ar : l.name_en);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-[var(--ink)]">{t('navLevel')}</h1>

      {/* Hero */}
      <div className="rounded-[var(--radius-lg)] bg-[var(--ink)] p-6 text-white sm:p-8">
        <p className="ev-eyebrow text-white/50">{t('currentLevel')}</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">{name(current)}</h2>
        <div className="mt-5">
          <div className="ev-progress bg-white/20">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <p className="ev-num mt-2 text-sm text-white/70">
            {next
              ? t('pointsToNext', { current: points.points, next: next.threshold, name: name(next) })
              : t('maxLevel', { points: points.points })}
          </p>
        </div>
      </div>

      {/* Ladder */}
      <section>
        <h3 className="mb-3 font-display text-lg font-bold text-[var(--ink)]">{t('allLevels')}</h3>
        <ul className="space-y-2">
          {EV_LEVELS.map((l) => {
            const isCurrent = l.index === current.index;
            const reached = points.points >= l.threshold;
            return (
              <li
                key={l.index}
                className="ev-card flex items-center gap-4 p-4"
                style={isCurrent ? { borderColor: 'var(--gold)', borderWidth: 2 } : undefined}
              >
                <span
                  className="ev-num flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    background: reached ? 'var(--gold-soft)' : 'var(--paper)',
                    color: reached ? 'var(--gold-deep)' : 'var(--ink-faint)',
                  }}
                >
                  {reached ? <Check className="h-5 w-5" /> : l.index}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--ink)]">{name(l)}</p>
                  <p className="ev-num text-xs text-[var(--ink-faint)]">{l.threshold}+ {t('points')}</p>
                </div>
                {isCurrent && <span className="ev-badge-gold">{t('youAreHere')}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
