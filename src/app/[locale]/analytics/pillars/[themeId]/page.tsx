import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { KPICard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from '@/components/charts/LineChart';
import { fetchPillarDetail } from '@/lib/data';
import { getScope } from '@/lib/scope';
import { getCurrentUser } from '@/lib/user';
import { ANALYTICS_ROLES, ROLE_HOME } from '@/lib/roles';
import { pick } from '@/lib/i18n-content';
import { formatSAR } from '@/lib/utils';
import { Lightbulb, Coins, FlaskConical, Rocket } from 'lucide-react';

export default async function PillarDetailPage({
  params,
}: {
  params: Promise<{ locale: string; themeId: string }>;
}) {
  const { locale, themeId } = await params;
  setRequestLocale(locale);

  const currentUser = await getCurrentUser();
  if (currentUser && !ANALYTICS_ROLES.includes(currentUser.role)) {
    redirect(`/${locale}${ROLE_HOME[currentUser.role]}`);
  }

  const t = await getTranslations('analytics');
  const scope = await getScope();
  const detail = await fetchPillarDetail(themeId, scope);
  if (!detail) notFound();

  const title = pick(detail.theme.title_ar, detail.theme.title_en, locale);
  const timeline = detail.timeline.map((p) => ({ date: p.date, value: p.value }));

  return (
    <AppShell>
      <PageHeader title={title} subtitle={detail.theme.description || undefined} />

      {detail.theme.owner && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('pillar.owner')}: <span className="font-medium text-foreground">{detail.theme.owner}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label={t('pillar.ideas')} value={detail.kpis.ideas} icon={Lightbulb} />
        <KPICard
          label={t('pillar.budget')}
          value={`${formatSAR(detail.kpis.budgetSpent, locale)} / ${formatSAR(detail.kpis.budgetAllocated, locale)}`}
          hint={t('pillar.budgetHint')}
          icon={Coins}
          accent="gold"
        />
        <KPICard label={t('pillar.pilotsActive')} value={detail.kpis.pilotsActive} icon={FlaskConical} />
        <KPICard label={t('pillar.implementations')} value={detail.kpis.implementationsDone} icon={Rocket} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('pillar.timeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length ? (
            <LineChart
              data={timeline}
              xKey="date"
              series={[{ key: 'value', name: t('pillar.ideas') }]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('pillar.ideasTable')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {detail.ideas.length ? (
            <table className="w-full text-sm">
              <thead className="bg-brand-teal-light/50">
                <tr>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('pillar.colCode')}</th>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('pillar.colTitle')}</th>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('pillar.colStatus')}</th>
                  <th className="p-3 text-end font-semibold text-brand-teal">{t('pillar.colStage')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.ideas.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{i.code}</td>
                    <td className="p-3 text-foreground">{pick(i.title_ar, i.title_en, locale)}</td>
                    <td className="p-3 text-muted-foreground">{i.status}</td>
                    <td className="p-3 text-end tabular-nums text-brand-teal">{i.current_stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
