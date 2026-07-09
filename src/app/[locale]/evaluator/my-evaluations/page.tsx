import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/user';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { MyEvaluationsList, type EvalRow } from '@/components/evaluator/my-evaluations-list';

export default async function MyEvaluationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  const dashboard = await fetchEvaluatorDashboard(user?.id ?? 'u2');

  const rows: EvalRow[] = dashboard.queue
    .filter((q) => q.eval_status === 'submitted')
    .map((q) => ({
      id: q.idea_id,
      title: (isAr ? q.title_ar : q.title_en) || q.idea_code || '—',
      category: (isAr ? q.theme_ar : q.theme_en) || null,
      date: q.submitted_evaluation_at,
      score: q.total_score,
    }));

  return <MyEvaluationsList locale={locale} rows={rows} />;
}
