import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';

const IMPLS = [
  {
    id: 'm1', title_ar: 'مؤشر تركز السوق الآلي', title_en: 'Automated market concentration index',
    owner: 'Digital Transformation Dept', plan: 'Integrate into BI stack over 2 sprints.',
    resources: '2 engineers, 1 analyst', unit: 'Analytics Unit', handover: 'in_progress',
  },
  {
    id: 'm2', title_ar: 'منصة موحدة لرصد الأسعار', title_en: 'Unified price monitoring platform',
    owner: 'Market Monitoring Dept', plan: 'Operationalize daily feed.',
    resources: '1 data engineer', unit: 'Monitoring Unit', handover: 'completed',
  },
];

export default async function ImplementationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('implementation');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {IMPLS.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-brand-teal">
                  {locale === 'ar' ? m.title_ar : m.title_en}
                </CardTitle>
                <StatusBadge status={m.handover} locale={locale} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t('owner')} value={m.owner} />
              <Row label={t('plan')} value={m.plan} />
              <Row label={t('resources')} value={m.resources} />
              <Row label={t('unit')} value={m.unit} />
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
