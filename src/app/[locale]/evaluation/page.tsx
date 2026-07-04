import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { EvaluationWorkspace } from '@/components/evaluation-workspace';
import { fetchMyQueue } from '@/lib/data';
import { getCurrentUser } from '@/lib/user';

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluation');

  // The evaluator's queue is driven by innovation.assignments (pending rows for
  // the signed-in evaluator, soonest due first). In preview/demo (no Supabase
  // session) fall back to a demo evaluator so the workspace renders populated.
  const user = await getCurrentUser();
  const evaluatorId = user?.id ?? 'u2';
  const assignments = await fetchMyQueue(evaluatorId);

  const queue = assignments.map((a) => ({
    id: a.idea_id,
    code: a.idea_code ?? a.idea_id,
    title_ar: a.idea_title_ar ?? '',
    title_en: a.idea_title_en ?? '',
    status: 'evaluation',
    due_at: a.due_at,
  }));

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EvaluationWorkspace queue={queue} locale={locale} />
    </AppShell>
  );
}
