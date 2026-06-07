import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { KnowledgeList } from '@/components/knowledge-list';
import { fetchKnowledge } from '@/lib/data';

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('knowledge');
  const articles = await fetchKnowledge();
  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <KnowledgeList articles={articles} locale={locale} />
    </AppShell>
  );
}
