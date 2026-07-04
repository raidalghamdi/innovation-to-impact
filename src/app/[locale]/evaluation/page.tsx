import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { EvaluationWorkspace } from '@/components/evaluation-workspace';
import { fetchIdeas } from '@/lib/data';

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluation');
  const ideas = await fetchIdeas();
  const queue = ideas
    .filter((i) => i.status === 'evaluation')
    .map((i) => ({
      id: i.id,
      code: i.code,
      title_ar: i.title_ar,
      title_en: i.title_en,
      status: i.status,
    }));

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EvaluationWorkspace queue={queue} locale={locale} />
    </AppShell>
  );
}
