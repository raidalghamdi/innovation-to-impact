import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { MigrateWizard } from '@/components/migrate-wizard';

export default async function MigratePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('migrate');
  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MigrateWizard locale={locale} />
    </AppShell>
  );
}
