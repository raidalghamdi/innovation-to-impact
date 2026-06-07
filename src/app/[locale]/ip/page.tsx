import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';

const RECORDS = [
  { id: 'ip1', idea: 'AI bid-rigging detection model', type: 'trade_secret', owner: 'GAC', nda: true, conditions: 'Contractors must sign NDA before access.' },
  { id: 'ip2', idea: 'Open data API', type: 'copyright', owner: 'GAC', nda: false, conditions: 'Attribution required (CC-BY).' },
];

export default async function IpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ip');
  const tc = await getTranslations('common');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="teal-header">
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">Idea</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('ipType')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('ownership')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('nda')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('conditions')}</th>
                </tr>
              </thead>
              <tbody>
                {RECORDS.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.idea}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3">{r.owner}</td>
                    <td className="px-4 py-3">{r.nda ? tc('yes') : tc('no')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.conditions}</td>
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
