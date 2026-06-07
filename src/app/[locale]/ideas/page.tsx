import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { IdeasExplorer } from '@/components/ideas-explorer';
import { fetchIdeas, fetchThemes, fetchActivities } from '@/lib/data';
import { Plus } from 'lucide-react';

export default async function IdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const [ideas, themes, activities] = await Promise.all([
    fetchIdeas(),
    fetchThemes(),
    fetchActivities(),
  ]);

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button asChild variant="gold">
            <Link href="/ideas/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <IdeasExplorer ideas={ideas} themes={themes} activities={activities} locale={locale} />
    </AppShell>
  );
}
