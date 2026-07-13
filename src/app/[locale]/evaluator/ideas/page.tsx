import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/user';
import { fetchEvaluatorDashboard } from '@/lib/data';
import { getEvaluatorTrackThemeIds } from '@/lib/evaluator-tracks';
import { EvaluatorQueue, type QueueCard } from '@/components/evaluator/evaluator-queue';
import { EvEmptyState } from '@/components/evaluator/ev-ui';
import { Layers } from 'lucide-react';

export default async function EvaluatorIdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  const evaluatorId = user?.id ?? 'u2';
  const [dashboard, tracks] = await Promise.all([
    fetchEvaluatorDashboard(evaluatorId),
    getEvaluatorTrackThemeIds(evaluatorId),
  ]);

  // Track filtering (R43): configured-with-zero-tracks → empty state;
  // configured-with-tracks → restrict to those themes; not configured → prior
  // behavior unchanged.
  if (tracks.configured && tracks.themeIds.length === 0) {
    const t = await getTranslations('evaluator');
    return (
      <EvEmptyState
        icon={Layers}
        title={t('noTracksAssigned.title')}
        hint={t('noTracksAssigned.body')}
      />
    );
  }
  const allowed =
    tracks.configured && tracks.themeIds.length > 0 ? new Set(tracks.themeIds) : null;

  // Only ideas still awaiting this evaluator's score belong in the queue.
  const cards: QueueCard[] = dashboard.queue
    .filter((q) => q.eval_status !== 'submitted')
    .filter((q) => !allowed || (q.theme_id && allowed.has(q.theme_id)))
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
