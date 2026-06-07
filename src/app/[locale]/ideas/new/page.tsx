import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { IdeaForm } from '@/components/idea-form';
import { fetchThemes, fetchActivities } from '@/lib/data';

export default async function NewIdeaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const [themes, activities] = await Promise.all([fetchThemes(), fetchActivities()]);

  return (
    <AppShell>
      <PageHeader title={t('new')} subtitle={t('subtitle')} />
      <IdeaForm themes={themes} activities={activities} locale={locale} />
    </AppShell>
  );
}
