import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { KPICard } from '@/components/kpi-card';
import { fetchCompliance } from '@/lib/data';
import { formatDate } from '@/lib/utils';
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

const REGULATOR_LABELS: Record<string, string> = {
  SDAIA_NDMO: 'SDAIA / NDMO',
  NCA: 'NCA',
  DGA: 'DGA',
  CST: 'CST',
  RDIA: 'RDIA',
};

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('compliance');
  const controls = await fetchCompliance();

  const compliant = controls.filter((c) => c.status === 'compliant').length;
  const inProgress = controls.filter((c) => c.status === 'in_progress').length;
  const nonCompliant = controls.filter((c) => c.status === 'non_compliant').length;

  const regulators = Array.from(new Set(controls.map((c) => c.regulator)));

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label={t('compliant')} value={compliant} icon={ShieldCheck} accent="gold" />
        <KPICard label={t('inProgress')} value={inProgress} icon={Clock} />
        <KPICard label={t('nonCompliant')} value={nonCompliant} icon={AlertTriangle} />
      </div>

      {regulators.map((reg) => (
        <Card key={reg} className="mt-6">
          <CardHeader>
            <CardTitle className="text-brand-teal">{REGULATOR_LABELS[reg] ?? reg}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-muted-foreground">{t('clause')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-muted-foreground">{t('mappedFeature')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-muted-foreground">{t('reviewCycle')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-muted-foreground">{t('lastReview')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {controls.filter((c) => c.regulator === reg).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="max-w-md px-4 py-3">{c.clause}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.mapped_feature}</td>
                      <td className="px-4 py-3">{c.review_cycle}</td>
                      <td className="px-4 py-3">{formatDate(c.last_review_date, locale)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} locale={locale} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </AppShell>
  );
}
