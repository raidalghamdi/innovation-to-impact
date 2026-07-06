import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { getAllRoles } from '@/lib/db-roles';
import { RolesCatalogClient } from '@/components/roles-catalog-client';

// src/app/[locale]/admin/roles/page.tsx:1
// Phase 11.4 — roles catalog editor.
export default async function AdminRolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const roles = await getAllRoles();

  return (
    <AppShell>
      <PageHeader title={t('rolesCatalog')} subtitle={locale === 'ar' ? `${roles.length} أدوار` : `${roles.length} roles`} />
      <RolesCatalogClient locale={locale} initialRoles={roles} />
    </AppShell>
  );
}
