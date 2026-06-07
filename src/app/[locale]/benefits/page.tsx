import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { KPICard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchBenefits, fetchIdeas } from '@/lib/data';
import { formatSAR, formatDate } from '@/lib/utils';
import { TrendingUp, Award } from 'lucide-react';

export default async function BenefitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('benefits');
  const [benefits, ideas] = await Promise.all([fetchBenefits(), fetchIdeas()]);

  const financial = benefits.filter((b) => b.benefit_type === 'financial');
  const nonFinancial = benefits.filter((b) => b.benefit_type === 'non_financial');
  const totalRealized = financial.reduce((s, b) => s + (b.realized_value || 0), 0);
  const totalTarget = financial.reduce((s, b) => s + (b.target_value || 0), 0);

  const ideaTitle = (id: string) => {
    const i = ideas.find((x) => x.id === id);
    return i ? (locale === 'ar' ? i.title_ar : i.title_en) : id;
  };

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label={`${t('financial')} (${t('realized')})`} value={`${formatSAR(totalRealized, locale)} SAR`} icon={TrendingUp} accent="gold" />
        <KPICard label={`${t('financial')} (${t('target')})`} value={`${formatSAR(totalTarget, locale)} SAR`} icon={TrendingUp} />
        <KPICard label={t('nonFinancial')} value={nonFinancial.length} icon={Award} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="teal-header">
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Idea</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('category')}</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('target')}</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('realized')}</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Unit</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3 line-clamp-1">{ideaTitle(b.idea_id)}</td>
                    <td className="px-4 py-3">{b.category}</td>
                    <td className="px-4 py-3">{b.target_value}</td>
                    <td className="px-4 py-3 font-medium">{b.realized_value}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.measurement_unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
