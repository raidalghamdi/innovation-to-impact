import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ImportWizard } from '@/components/import-wizard';

// Admin-only bulk CSV import (WS7 F2). The /admin prefix is already gated to
// admins by middleware (ROLE_DENY); the server action re-checks the role.
export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('import');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <ImportWizard locale={locale} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
