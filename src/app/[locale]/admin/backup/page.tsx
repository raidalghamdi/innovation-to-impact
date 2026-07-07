import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { AdminBackupPanel } from '@/components/admin-backup-panel';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';

// src/app/[locale]/admin/backup/page.tsx
// Admin-only page that exposes full-DB export (Excel) and safe-merge import.
// Auth: session must be present AND user must be admin. Password re-auth is
// enforced server-side inside /api/admin/backup/{export,import}, not here.
export default async function AdminBackupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'النسخ الاحتياطي لقاعدة البيانات' : 'Database backup'}
        subtitle={
          isAr
            ? 'تصدير كل بيانات المنصة إلى ملف Excel، أو استيراد ملف موجود لدمجه بأمان.'
            : 'Export every platform table to a single Excel workbook, or import an existing workbook to merge safely.'
        }
      />
      <AdminBackupPanel locale={locale} />
    </AppShell>
  );
}
