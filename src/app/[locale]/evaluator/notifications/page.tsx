import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EvaluatorNotifications } from '@/components/evaluator/evaluator-notifications';

export default async function EvaluatorNotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink)]">{t('navNotifications')}</h1>
      <EvaluatorNotifications locale={locale} />
    </div>
  );
}
