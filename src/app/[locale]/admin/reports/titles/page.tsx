import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { getReportTitles } from '@/lib/reports-charts';
import { ReportTitlesEditor } from '@/components/reports/report-titles-editor';

export const dynamic = 'force-dynamic';

/**
 * /admin/reports/titles — dedicated admin surface for editing the bilingual
 * report, chart, and KPI titles that back the Reports Center. Admin-only;
 * writes go through the same server action as the in-page modal and land in
 * innovation.report_titles.
 */
export default async function ReportTitlesPage({
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
  const titles = await getReportTitles();
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'تحرير عناوين التقارير' : 'Edit Report Titles'}
        subtitle={
          isAr
            ? 'تحكّم كامل في عناوين مركز التقارير ومؤشراته ورسومه بالعربية والإنجليزية.'
            : 'Full control over the Reports Center titles, KPIs, and chart headings in Arabic and English.'
        }
        action={
          <Button asChild variant="outline">
            <Link href="/admin/reports">
              <BackIcon className="h-4 w-4" />
              {isAr ? 'العودة إلى التقارير' : 'Back to Reports'}
            </Link>
          </Button>
        }
      />
      <ReportTitlesEditor titles={titles} locale={locale} />
    </AppShell>
  );
}
