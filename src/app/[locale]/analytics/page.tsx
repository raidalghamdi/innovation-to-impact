import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { KPICard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchIdeas, fetchBenefits } from '@/lib/data';
import { formatSAR } from '@/lib/utils';
import { Users, GitMerge, Clock, FlaskConical, Rocket, TrendingUp } from 'lucide-react';

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('analytics');
  const [ideas, benefits] = await Promise.all([fetchIdeas(), fetchBenefits()]);

  const total = ideas.length;
  const approved = ideas.filter((i) => ['approved', 'in_pilot', 'in_implementation', 'benefits_tracking', 'closed'].includes(i.status)).length;
  const piloted = ideas.filter((i) => i.current_stage >= 6).length;
  const scaled = ideas.filter((i) => i.current_stage >= 7).length;
  const conversion = Math.round((approved / total) * 100);
  const pilotSuccess = piloted ? Math.round((scaled / piloted) * 100) : 0;
  const scaleRate = approved ? Math.round((scaled / approved) * 100) : 0;
  const realized = benefits.filter((b) => b.benefit_type === 'financial').reduce((s, b) => s + b.realized_value, 0);

  // simple funnel
  const funnel = [
    { label: t('participation'), value: total },
    { label: 'Evaluated', value: ideas.filter((i) => i.current_stage >= 4).length },
    { label: 'Approved', value: approved },
    { label: 'Piloted', value: piloted },
    { label: 'Scaled', value: scaled },
  ];
  const max = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          label={t('participation')}
          value={total}
          icon={Users}
          href="/ideas"
          hrefLabel={t('viewIdeas')}
          locale={locale}
        />
        <KPICard
          label={t('conversion')}
          value={`${conversion}%`}
          icon={GitMerge}
          href="/ideas?status=approved"
          hrefLabel={t('viewApproved')}
          locale={locale}
        />
        <KPICard
          label={t('cycleTime')}
          value={42}
          icon={Clock}
          href="/ideas?pipeline=1"
          hrefLabel={t('viewIdeas')}
          locale={locale}
        />
        <KPICard
          label={t('pilotSuccess')}
          value={`${pilotSuccess}%`}
          icon={FlaskConical}
          href="/pilots"
          hrefLabel={t('viewPilots')}
          locale={locale}
        />
        <KPICard
          label={t('scaleRate')}
          value={`${scaleRate}%`}
          icon={Rocket}
          href="/ideas?stage=7"
          hrefLabel={t('viewImplementation')}
          locale={locale}
        />
        <KPICard
          label={t('benefitsRealized')}
          value={`${formatSAR(realized, locale)} SAR`}
          icon={TrendingUp}
          accent="gold"
          href="/benefits"
          hrefLabel={t('viewBenefits')}
          locale={locale}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('conversion')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnel.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">{f.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-brand-teal px-2 text-xs font-medium text-white"
                  style={{ width: `${Math.max((f.value / max) * 100, 8)}%` }}
                >
                  {f.value}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
