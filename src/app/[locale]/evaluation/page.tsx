import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { EvaluatorDashboardView } from '@/components/evaluator-dashboard';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { getCurrentUser } from '@/lib/user';

// Evaluator dashboard — batch 07/26 rebuild.
// Single-fetch aggregate (assignments + ideas + themes + teams + evaluations
// + video presence) so the client renders KPIs, filters, queue, and detail
// card without extra roundtrips.
export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluation');

  const user = await getCurrentUser();
  const evaluatorId = user?.id ?? 'u2';
  const dashboard = await fetchEvaluatorDashboard(evaluatorId);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EvaluatorDashboardView dashboard={dashboard} locale={locale} />
    </AppShell>
  );
}
