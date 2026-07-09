import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CalendarClock } from 'lucide-react';

export default async function EvaluatorSchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{t('scheduleTitle')}</h1>
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-16 text-center">
        <CalendarClock className="h-12 w-12 text-[var(--ink-faint)]" strokeWidth={1.5} />
        <p className="mt-4 font-display text-lg font-bold text-[var(--ink)]">{t('comingSoon')}</p>
      </div>
    </div>
  );
}
