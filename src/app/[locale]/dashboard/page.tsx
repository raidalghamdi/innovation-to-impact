import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { KPICard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Link } from '@/i18n/routing';
import { fetchIdeas } from '@/lib/data';
import { getStats } from '@/lib/demo-data';
import { formatSAR, formatDate } from '@/lib/utils';
import { Lightbulb, GitBranch, FlaskConical, TrendingUp, Users } from 'lucide-react';

const STAGE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const ts = await getTranslations('stages');
  const stats = getStats();
  const ideas = await fetchIdeas();

  // ideas by stage
  const byStage = STAGE_KEYS.map((key, i) => ({
    key,
    label: ts(key as any),
    count: ideas.filter((x) => x.current_stage === i).length,
  }));
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));
  const recent = [...ideas].slice(0, 6);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('welcome')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label={t('totalIdeas')} value={stats.total} icon={Lightbulb} />
        <KPICard label={t('inPipeline')} value={stats.inPipeline} icon={GitBranch} />
        <KPICard label={t('inPilot')} value={stats.inPilot} icon={FlaskConical} />
        <KPICard label={t('realizedBenefits')} value={`${formatSAR(stats.realizedBenefits, locale)}`} icon={TrendingUp} accent="gold" />
        <KPICard label={t('participationRate')} value={`${stats.participationRate}%`} icon={Users} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('byStage')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byStage.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-xs text-muted-foreground">
                  {i}. {s.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand-teal"
                    style={{ width: `${(s.count / maxStage) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-end text-sm font-medium">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('recentIdeas')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((idea) => (
              <Link
                key={idea.id}
                href={`/ideas/${idea.id}`}
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-brand-gold">{idea.code}</span>
                  <StatusBadge status={idea.status} locale={locale} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm font-medium">
                  {locale === 'ar' ? idea.title_ar : idea.title_en}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(idea.created_at, locale)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
