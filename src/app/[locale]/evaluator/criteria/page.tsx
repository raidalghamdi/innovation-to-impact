import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EV_CRITERIA } from '@/lib/evaluator-criteria';

export default async function EvaluatorCriteriaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{t('criteriaTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('criteriaIntro')}</p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {EV_CRITERIA.map((c) => (
          <li key={c} className="ev-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-base font-bold text-[var(--ink)]">{t(`crit_${c}`)}</p>
              <span className="ev-badge-gold ev-num">0–10</span>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{t(`critHint_${c}`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
