import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { ComplianceControlCard } from '@/components/compliance-control-card';
import { fetchComplianceControls, STANDARD_BODIES } from '@/lib/data';
import { getCurrentUser } from '@/lib/user';
import { ShieldCheck, ListChecks } from 'lucide-react';

const BODY_LABELS: Record<string, string> = {
  SDAIA: 'SDAIA',
  NDMO: 'NDMO',
  DGA: 'DGA',
  NCA: 'NCA',
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
  const [controls, user] = await Promise.all([fetchComplianceControls(), getCurrentUser()]);
  const isAdmin = user?.role === 'admin';

  const met = controls.filter((c) => c.status === 'met').length;

  // Preserve the canonical body ordering, then any unexpected bodies.
  const bodies = [
    ...STANDARD_BODIES.filter((b) => controls.some((c) => c.standard_body === b)),
    ...Array.from(new Set(controls.map((c) => c.standard_body))).filter(
      (b) => !STANDARD_BODIES.includes(b as (typeof STANDARD_BODIES)[number])
    ),
  ];

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard label={t('totalControls')} value={controls.length} icon={ListChecks} />
        <KPICard label={t('metCount')} value={met} icon={ShieldCheck} accent="gold" />
      </div>

      {bodies.map((body) => (
        <Card key={body} className="mt-6">
          <CardHeader>
            <CardTitle className="text-brand-teal">{BODY_LABELS[body] ?? body}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {controls
                .filter((c) => c.standard_body === body)
                .map((c) => (
                  <ComplianceControlCard key={c.id} control={c} locale={locale} isAdmin={isAdmin} />
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </AppShell>
  );
}
