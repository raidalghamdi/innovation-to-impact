import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { ReportsCenter } from '@/components/reports-center';

/**
 * /admin/reports — Reports Center.
 *
 * Admin-only page. Presents a card for each of the 12 report types. Selecting
 * a card opens a right-side panel with format, date range, and delivery
 * options (download vs. email). All rendering happens server-side via
 * `/api/admin/reports/generate`.
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}`);
  }

  const isAr = locale === 'ar';

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'مركز التقارير' : 'Reports Center'}
        subtitle={
          isAr
            ? 'اختر نوع التقرير، الصيغة، والفترة الزمنية. حمّل مباشرة أو أرسل إلى البريد.'
            : 'Pick a report type, format, and date range. Download directly or send to email.'
        }
      />
      <ReportsCenter locale={locale} />
    </AppShell>
  );
}
