import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getPlatformKpis,
  getFunnel,
  getMonthlyCohort,
  getThemeActivity,
  getTopEvaluators,
  getIdeasByStage,
  getSubmissionsPerDay,
  getTopObjectives,
  getAvgTimePerStage,
  getSubmittedToPilotConversion,
  type CohortRow,
  type FunnelRow,
} from '@/lib/analytics';
import { getCurrentUser } from '@/lib/user';
import { ANALYTICS_ROLES, ROLE_HOME } from '@/lib/roles';
import {
  IdeasByStageChart,
  SubmissionsLineChart,
  TopObjectivesChart,
  AvgTimePerStageTable,
  ConversionStatCard,
} from '@/components/executive-analytics';
import {
  Send,
  CheckCircle2,
  Rocket,
  Users,
  ClipboardCheck,
  UserCircle,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// design-foundations chart sequence: teal, terra, dark teal, cyan, mauve
const SERIES = ['#20808D', '#A84B2F', '#1B474D', '#BCE2E7', '#944454'];

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold text-brand-teal">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelChart({ rows, empty }: { rows: FunnelRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.stage} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={r.stage}>
            {r.stage}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full items-center justify-end rounded-md bg-brand-teal px-2 text-[11px] font-medium text-white"
              style={{ width: `${Math.max((r.n / max) * 100, 6)}%` }}
            >
              {r.n}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CohortChart({
  rows,
  labels,
}: {
  rows: CohortRow[];
  labels: { submitted: string; approved: string; rejected: string; implemented: string };
}) {
  const series: { key: keyof Omit<CohortRow, 'cohort_month'>; label: string; color: string }[] = [
    { key: 'submitted', label: labels.submitted, color: SERIES[0] },
    { key: 'approved', label: labels.approved, color: SERIES[2] },
    { key: 'rejected', label: labels.rejected, color: SERIES[1] },
    { key: 'implemented', label: labels.implemented, color: SERIES[4] },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0)));

  const W = Math.max(rows.length * 84, 320);
  const H = 200;
  const pad = { top: 10, bottom: 28, left: 28, right: 8 };
  const chartH = H - pad.top - pad.bottom;
  const groupW = (W - pad.left - pad.right) / Math.max(rows.length, 1);
  const barW = Math.min(14, (groupW - 8) / series.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img" className="min-w-full">
          {/* baseline */}
          <line
            x1={pad.left}
            y1={pad.top + chartH}
            x2={W - pad.right}
            y2={pad.top + chartH}
            stroke="currentColor"
            className="text-border"
          />
          {rows.map((r, gi) => {
            const gx = pad.left + gi * groupW + 4;
            return (
              <g key={r.cohort_month}>
                {series.map((s, si) => {
                  const val = Number(r[s.key]) || 0;
                  const h = (val / max) * chartH;
                  const x = gx + si * (barW + 2);
                  const y = pad.top + chartH - h;
                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      fill={s.color}
                      rx={2}
                    >
                      <title>{`${s.label}: ${val}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={gx + (series.length * (barW + 2)) / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {r.cohort_month?.slice(0, 7)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fine-grained role check — middleware only guards the whole /admin prefix.
  // Judges are explicitly allowed here (see ANALYTICS_ROLES in src/lib/roles.ts).
  const currentUser = await getCurrentUser();
  if (currentUser && !ANALYTICS_ROLES.includes(currentUser.role)) {
    redirect(`/${locale}${ROLE_HOME[currentUser.role]}`);
  }

  const t = await getTranslations('analytics');
  const tc = await getTranslations('common');
  const tStages = await getTranslations('stages');
  const isAr = locale === 'ar';

  const [
    kpis,
    funnel,
    cohort,
    themes,
    evaluators,
    byStage,
    perDay,
    topObjectives,
    avgPerStage,
    conversion,
  ] = await Promise.all([
    getPlatformKpis(),
    getFunnel(),
    getMonthlyCohort(),
    getThemeActivity(),
    getTopEvaluators(),
    getIdeasByStage(),
    getSubmissionsPerDay(90),
    getTopObjectives(5),
    getAvgTimePerStage(),
    getSubmittedToPilotConversion(),
  ]);

  const stageLabels = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(
    (k) => tStages(k as 's0'),
  );

  // Always Latin digits regardless of UI locale (per user preference)
  const sar = new Intl.NumberFormat('en-US').format(
    kpis.realized_financial_impact ?? 0
  );

  return (
    <AppShell>
      <PageHeader title={t('adminTitle')} subtitle={t('adminSubtitle')} />

      {/* ===== Executive Dashboard (5 charts) ===== */}
      <section className="space-y-4" aria-labelledby="exec-dashboard-heading">
        <div>
          <h2
            id="exec-dashboard-heading"
            className="text-lg font-bold text-brand-teal sm:text-xl"
          >
            {t('execTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('execSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('byStageTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('byStageSubtitle')}</p>
            </CardHeader>
            <CardContent>
              <IdeasByStageChart
                rows={byStage}
                stageLabels={stageLabels}
                empty={t('empty')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('perDayTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('perDaySubtitle')}</p>
            </CardHeader>
            <CardContent>
              <SubmissionsLineChart rows={perDay} empty={t('empty')} locale={locale} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('topObjectivesTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t('topObjectivesSubtitle')}
              </p>
            </CardHeader>
            <CardContent>
              <TopObjectivesChart
                rows={topObjectives}
                empty={t('empty')}
                locale={locale}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('conversionTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('conversionSubtitle')}</p>
            </CardHeader>
            <CardContent>
              <ConversionStatCard
                submitted={conversion.submitted}
                pilot={conversion.pilot}
                rate={conversion.rate}
                labels={{
                  submitted: t('conversionSubmitted'),
                  pilot: t('conversionPilot'),
                  rate: t('conversionRate'),
                }}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('avgTimeTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('avgTimeSubtitle')}</p>
          </CardHeader>
          <CardContent className="p-0">
            <AvgTimePerStageTable
              rows={avgPerStage}
              stageLabels={stageLabels}
              headers={{ stage: t('avgTimeStage'), avg: t('avgTimeDays') }}
              empty={t('empty')}
            />
          </CardContent>
        </Card>
      </section>

      {/* ===== Platform-wide KPIs (existing) ===== */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-brand-teal sm:text-xl">
          {t('platformKpisTitle')}
        </h2>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Send} label={t('kpiSubmissions')} value={String(kpis.total_submissions)} />
        <Kpi icon={CheckCircle2} label={t('kpiApproved')} value={String(kpis.total_approved)} />
        <Kpi icon={Rocket} label={t('kpiImplemented')} value={String(kpis.total_implemented)} />
        <Kpi icon={Users} label={t('kpiActiveSubmitters')} value={String(kpis.active_submitters)} />
        <Kpi icon={ClipboardCheck} label={t('kpiEvaluations')} value={String(kpis.total_evaluations)} />
        <Kpi icon={UserCircle} label={t('kpiUsers')} value={String(kpis.total_users)} />
        <Kpi icon={ShieldCheck} label={t('kpiEvaluators')} value={String(kpis.total_evaluators)} />
        <Kpi icon={Coins} label={t('kpiFinancialImpact')} value={sar} />
      </div>

      {/* Funnel + cohort */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('funnelTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('funnelSubtitle')}</p>
          </CardHeader>
          <CardContent>
            <FunnelChart rows={funnel} empty={t('empty')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('cohortTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('cohortSubtitle')}</p>
          </CardHeader>
          <CardContent>
            {cohort.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <CohortChart
                rows={cohort}
                labels={{
                  submitted: t('submitted'),
                  approved: t('approved'),
                  rejected: t('rejected'),
                  implemented: t('implemented'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Theme activity + top evaluators */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('themeTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('themeSubtitle')}</p>
          </CardHeader>
          <CardContent className="p-0">
            {themes.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('theme')}</th>
                    <th className="p-3 text-end font-semibold text-brand-teal">{t('ideas')}</th>
                    <th className="p-3 text-end font-semibold text-brand-teal">{t('approved')}</th>
                  </tr>
                </thead>
                <tbody>
                  {themes.map((r) => (
                    <tr key={r.theme_id} className="border-t border-border">
                      <td className="p-3 text-foreground">
                        {(isAr ? r.name_ar : r.name_en) || r.name_en || r.name_ar || '—'}
                      </td>
                      <td className="p-3 text-end text-muted-foreground">{r.n_ideas}</td>
                      <td className="p-3 text-end font-medium text-brand-teal">{r.n_approved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('evaluatorsTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('evaluatorsSubtitle')}</p>
          </CardHeader>
          <CardContent className="p-0">
            {evaluators.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('evaluator')}</th>
                    <th className="p-3 text-end font-semibold text-brand-teal">{t('evaluations')}</th>
                    <th className="p-3 text-end font-semibold text-brand-teal">{t('avgScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluators.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 text-foreground">
                        {(isAr ? r.full_name_ar : r.full_name) || r.full_name || r.email || '—'}
                      </td>
                      <td className="p-3 text-end text-muted-foreground">{r.n_evaluations}</td>
                      <td className="p-3 text-end font-medium text-brand-teal">
                        {r.avg_score != null ? Number(r.avg_score).toFixed(1) : tc('noData')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
