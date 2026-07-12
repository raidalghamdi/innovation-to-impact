import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { ReportsCenter } from '@/components/reports-center';
import { ReportsCenterCharts } from '@/components/reports-center-charts';
import { getReportChartsData, getReportTitles } from '@/lib/reports-charts';
import { ExportBar } from '@/components/exports/ExportBar';

/**
 * /admin/reports — Reports Center.
 *
 * Admin-only page. Two surfaces stacked: an analytics dashboard of eight rich
 * lifecycle charts (with admin-editable titles) on top, then the report
 * generator — a card per report type that opens a right-side panel with format,
 * date range, and delivery options. Generation runs server-side via
 * `/api/admin/reports/generate`; chart data is fetched here in parallel.
 */
export async function ReportsView({
  params,
  screenPrefix = 'admin',
}: {
  params: Promise<{ locale: string }>;
  screenPrefix?: 'admin' | 'supervisor';
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}`);
  }

  const isAr = locale === 'ar';

  const [chartsData, titles] = await Promise.all([getReportChartsData(), getReportTitles()]);

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'مركز التقارير' : 'Reports Center'}
        subtitle={
          isAr
            ? 'لوحة تحليلية تفاعلية ومولّد تقارير — استعرض المؤشرات ثم حمّل أو أرسل التقارير.'
            : 'Interactive analytics dashboard and report generator — review indicators, then download or email reports.'
        }
        action={<ExportBar screenId={`${screenPrefix}.reports`} sensitive={false} />}
      />
      <ReportsCenterCharts data={chartsData} titles={titles} locale={locale} isAdmin={user.role === 'admin'} />
      <div className="mt-10">
        <ReportsCenter locale={locale} />
      </div>
    </AppShell>
  );
}

export default function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <ReportsView params={params} screenPrefix="admin" />;
}
