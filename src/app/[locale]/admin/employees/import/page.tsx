import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { getActiveRoles } from '@/lib/db-roles';
import { EmployeeImportClient } from '@/components/employee-import-client';

// src/app/[locale]/admin/employees/import/page.tsx:1
export default async function EmployeeImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('employeeImport');
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const roles = await getActiveRoles();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EmployeeImportClient
        locale={locale}
        roles={roles.map((r) => ({ code: r.code, name_ar: r.name_ar, name_en: r.name_en }))}
      />
    </AppShell>
  );
}
