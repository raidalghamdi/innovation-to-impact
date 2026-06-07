import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { KPICard } from '@/components/kpi-card';
import { formatSAR } from '@/lib/utils';
import { Wallet, CheckCircle2 } from 'lucide-react';

const REQUESTS = [
  { id: 'fr1', idea: 'Retailer complaints portal', amount: 150000, approved: 150000, status: 'disbursed' },
  { id: 'fr2', idea: 'AI bid-rigging detection model', amount: 300000, approved: 250000, status: 'approved' },
  { id: 'fr3', idea: 'Consumer awareness campaign', amount: 90000, approved: null, status: 'requested' },
];

export default async function FundingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('funding');

  const totalRequested = REQUESTS.reduce((s, r) => s + r.amount, 0);
  const totalApproved = REQUESTS.reduce((s, r) => s + (r.approved || 0), 0);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard label={t('requested')} value={`${formatSAR(totalRequested, locale)} SAR`} icon={Wallet} />
        <KPICard label={t('approved')} value={`${formatSAR(totalApproved, locale)} SAR`} icon={CheckCircle2} accent="gold" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="teal-header">
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">Idea</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('amount')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('approvedAmount')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {REQUESTS.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.idea}</td>
                    <td className="px-4 py-3">{formatSAR(r.amount, locale)}</td>
                    <td className="px-4 py-3">{r.approved ? formatSAR(r.approved, locale) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} locale={locale} /></td>
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
