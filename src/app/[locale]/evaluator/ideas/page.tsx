import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/user';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { EvaluatorQueue, type QueueCard } from '@/components/evaluator/evaluator-queue';

export default async function EvaluatorIdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  const dashboard = await fetchEvaluatorDashboard(user?.id ?? 'u2');

  // Only ideas still awaiting this evaluator's score belong in the queue.
  const cards: QueueCard[] = dashboard.queue
    .filter((q) => q.eval_status !== 'submitted')
    .map((q) => ({
      id: q.idea_id,
      title: (isAr ? q.title_ar : q.title_en) || q.idea_code || '—',
      description: q.problem_statement || q.proposed_solution || '',
      category: (isAr ? q.theme_ar : q.theme_en) || null,
      team: null,
      submittedAt: q.submitted_at,
    }));

  return <EvaluatorQueue locale={locale} cards={cards} />;
}
