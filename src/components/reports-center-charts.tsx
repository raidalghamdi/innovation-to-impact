'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle2, Gavel, Loader2, Pencil, Save, Star, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PieChart } from '@/components/charts/PieChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { seriesColor } from '@/components/charts/theme';
import { pickTitle, type ReportTitle } from '@/lib/report-titles';
import type { ReportChartsData } from '@/lib/reports-charts';
import { updateReportTitles, type TitlePatch } from '@/app/[locale]/admin/reports/actions';

type TitleMap = Record<string, ReportTitle>;

// Ordered list the Edit Titles modal iterates over — hero + section + 8 charts.
const EDITABLE_KEYS = [
  'reports_center_hero',
  'reports_center_charts_section',
  'kpi_total_ideas',
  'kpi_approved',
  'kpi_avg_score',
  'kpi_committee_decisions',
  'chart_a_ideas_by_status',
  'chart_b_submissions_timeline',
  'chart_c_approval_funnel',
  'chart_d_ideas_by_theme',
  'chart_e_score_distribution',
  'chart_f_time_to_decision',
  'chart_g_top_innovators',
  'chart_h_committee_trend',
] as const;

// --- Bilingual axis/label vocabularies --------------------------------------
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  submitted: { ar: 'مقدَّمة', en: 'Submitted' },
  screening: { ar: 'الفرز', en: 'Screening' },
  needs_completion: { ar: 'بحاجة لاستكمال', en: 'Needs completion' },
  evaluation: { ar: 'التقييم', en: 'Evaluation' },
  committee: { ar: 'اللجنة', en: 'Committee' },
  approved: { ar: 'معتمدة', en: 'Approved' },
  rejected: { ar: 'مرفوضة', en: 'Rejected' },
  returned: { ar: 'مُعادة', en: 'Returned' },
  assigned: { ar: 'مُسندة', en: 'Assigned' },
  in_pilot: { ar: 'تجربة', en: 'In pilot' },
  in_implementation: { ar: 'تنفيذ', en: 'In implementation' },
  benefits_tracking: { ar: 'تتبّع الأثر', en: 'Benefits tracking' },
  closed: { ar: 'مغلقة', en: 'Closed' },
  archived: { ar: 'مؤرشفة', en: 'Archived' },
};

const FUNNEL_LABELS: Record<string, { ar: string; en: string }> = {
  submitted: { ar: 'مقدَّمة', en: 'Submitted' },
  screened: { ar: 'مفروزة', en: 'Screened' },
  evaluated: { ar: 'مُقيَّمة', en: 'Evaluated' },
  committee: { ar: 'اللجنة', en: 'Committee' },
  approved: { ar: 'معتمدة', en: 'Approved' },
};

function label(map: Record<string, { ar: string; en: string }>, key: string, isAr: boolean): string {
  const v = map[key];
  if (!v) return key;
  return isAr ? v.ar : v.en;
}

// YYYY-MM → localized month name + Latin-digit year (digits stay Latin per the
// site-wide numeral preference).
function monthLabel(ym: string, isAr: boolean): string {
  const [y, m] = ym.split('-');
  const monthIdx = Number(m) - 1;
  if (!y || Number.isNaN(monthIdx)) return ym;
  const d = new Date(Date.UTC(2000, monthIdx, 1));
  const name = new Intl.DateTimeFormat(isAr ? 'ar' : 'en-US', { month: 'short' }).format(d);
  return `${name} ${y}`;
}

function innovatorName(r: { name_ar: string | null; name_en: string | null; id: string }, isAr: boolean): string {
  return (isAr ? r.name_ar : r.name_en) || r.name_en || r.name_ar || r.id.slice(0, 8);
}

function themeName(r: { name_ar: string | null; name_en: string | null; theme_id: string }, isAr: boolean): string {
  return (isAr ? r.name_ar : r.name_en) || r.name_en || r.name_ar || r.theme_id.slice(0, 8);
}

// --- Card shell -------------------------------------------------------------
function ChartCard({
  titleKey,
  titles,
  locale,
  children,
  hasData,
}: {
  titleKey: string;
  titles: TitleMap;
  locale: string;
  children: React.ReactNode;
  hasData: boolean;
}) {
  const { title, subtitle } = pickTitle(titles[titleKey], locale);
  const isAr = locale === 'ar';
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <h3 className="text-base font-semibold text-brand-teal">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        {hasData ? (
          children
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
            {isAr ? 'لا توجد بيانات كافية بعد.' : 'Not enough data yet.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Edit Titles modal ------------------------------------------------------
function EditTitlesModal({
  titles,
  locale,
  onClose,
}: {
  titles: TitleMap;
  locale: string;
  onClose: () => void;
}) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, TitlePatch>>(() => {
    const seed: Record<string, TitlePatch> = {};
    for (const key of EDITABLE_KEYS) {
      const t = titles[key];
      seed[key] = {
        key,
        title_ar: t?.title_ar ?? '',
        title_en: t?.title_en ?? '',
        subtitle_ar: t?.subtitle_ar ?? '',
        subtitle_en: t?.subtitle_en ?? '',
      };
    }
    return seed;
  });

  const setField = (key: string, field: keyof Omit<TitlePatch, 'key'>, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateReportTitles(Object.values(draft));
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="card-surface my-4 w-full max-w-3xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-lg font-semibold text-brand-teal">
            {isAr ? 'تحرير عناوين التقارير' : 'Edit Report Titles'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          {EDITABLE_KEYS.map((key) => (
            <div key={key} className="rounded-md border border-border p-4">
              <p className="mb-3 font-mono text-xs text-muted-foreground">{key}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${key}-title_ar`}>{isAr ? 'العنوان (عربي)' : 'Title (AR)'}</Label>
                  <Input
                    id={`${key}-title_ar`}
                    dir="rtl"
                    value={draft[key].title_ar ?? ''}
                    onChange={(e) => setField(key, 'title_ar', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${key}-title_en`}>{isAr ? 'العنوان (إنجليزي)' : 'Title (EN)'}</Label>
                  <Input
                    id={`${key}-title_en`}
                    dir="ltr"
                    value={draft[key].title_en ?? ''}
                    onChange={(e) => setField(key, 'title_en', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${key}-subtitle_ar`}>{isAr ? 'الوصف (عربي)' : 'Subtitle (AR)'}</Label>
                  <Input
                    id={`${key}-subtitle_ar`}
                    dir="rtl"
                    value={draft[key].subtitle_ar ?? ''}
                    onChange={(e) => setField(key, 'subtitle_ar', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${key}-subtitle_en`}>{isAr ? 'الوصف (إنجليزي)' : 'Subtitle (EN)'}</Label>
                  <Input
                    id={`${key}-subtitle_en`}
                    dir="ltr"
                    value={draft[key].subtitle_en ?? ''}
                    onChange={(e) => setField(key, 'subtitle_en', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-5">
          {error ? (
            <p className="text-sm text-destructive">
              {isAr ? 'تعذّر الحفظ: ' : 'Save failed: '}
              {error}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              {isAr ? 'اترك حقلاً فارغًا للرجوع إلى الافتراضي.' : 'Leave a field blank to fall back to the default.'}
            </span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={onSave} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isAr ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main surface -----------------------------------------------------------
export function ReportsCenterCharts({
  data,
  titles,
  locale,
  isAdmin,
}: {
  data: ReportChartsData;
  titles: TitleMap;
  locale: string;
  isAdmin: boolean;
}) {
  const isAr = locale === 'ar';
  const [editing, setEditing] = useState(false);

  const hero = pickTitle(titles.reports_center_hero, locale);
  const section = pickTitle(titles.reports_center_charts_section, locale);

  const statusData = useMemo(
    () => data.ideasByStatus.map((s) => ({ label: label(STATUS_LABELS, s.status, isAr), value: s.count })),
    [data.ideasByStatus, isAr]
  );
  const timelineData = useMemo(
    () => data.submissionsTimeline.map((p) => ({ month: monthLabel(p.month, isAr), count: p.count })),
    [data.submissionsTimeline, isAr]
  );
  const funnelData = useMemo(
    () => data.approvalFunnel.map((f) => ({ label: label(FUNNEL_LABELS, f.key, isAr), count: f.count })),
    [data.approvalFunnel, isAr]
  );
  const themeData = useMemo(
    () => data.ideasByTheme.map((t) => ({ label: themeName(t, isAr), count: t.count })),
    [data.ideasByTheme, isAr]
  );
  const scoreData = useMemo(
    () => data.scoreDistribution.map((b) => ({ bucket: String(b.bucket), count: b.count })),
    [data.scoreDistribution]
  );
  const stageData = useMemo(
    () =>
      data.timeToDecision.map((s) => ({
        stage: `${isAr ? 'مرحلة' : 'Stage'} ${s.stage}`,
        avg_days: s.avg_days,
      })),
    [data.timeToDecision, isAr]
  );
  const innovatorData = useMemo(
    () => data.topInnovators.map((r) => ({ label: innovatorName(r, isAr), count: r.count })),
    [data.topInnovators, isAr]
  );
  const committeeData = useMemo(
    () =>
      data.committeeTrend.map((c) => ({
        month: monthLabel(c.month, isAr),
        approve: c.approve,
        reject: c.reject,
      })),
    [data.committeeTrend, isAr]
  );

  const funnelHasData = funnelData.some((f) => f.count > 0);
  const scoreHasData = scoreData.some((b) => b.count > 0);
  const stageHasData = stageData.some((s) => s.avg_days > 0);

  // --- KPI strip (numeric headline metrics + sparklines) --------------------
  const kpis = useMemo(() => {
    const totalIdeas = data.ideasByStatus.reduce((sum, s) => sum + s.count, 0);
    const approved = data.approvalFunnel.find((f) => f.key === 'approved')?.count ?? 0;

    let weighted = 0;
    let evalCount = 0;
    for (const b of data.scoreDistribution) {
      weighted += b.bucket * b.count;
      evalCount += b.count;
    }
    const avgScore = evalCount > 0 ? Number((weighted / evalCount).toFixed(1)) : 0;

    const committeeTotal = data.committeeTrend.reduce((sum, c) => sum + c.approve + c.reject, 0);

    // Cumulative submissions form a rising sparkline; committee series feed theirs.
    let running = 0;
    const totalSeries = data.submissionsTimeline.map((p) => {
      running += p.count;
      return running;
    });
    const approvedSeries = data.committeeTrend.map((c) => c.approve);
    const scoreSeries = data.scoreDistribution.map((b) => b.count);
    const committeeSeries = data.committeeTrend.map((c) => c.approve + c.reject);

    return { totalIdeas, approved, avgScore, committeeTotal, totalSeries, approvedSeries, scoreSeries, committeeSeries };
  }, [data]);

  const kpiLabel = (key: string) => pickTitle(titles[key], locale).title;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-none bg-brand-teal text-white shadow-md">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-white/10 p-3">
              <BarChart3 className="h-7 w-7 text-brand-cyan" />
            </span>
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">{hero.title}</h2>
              {hero.subtitle && <p className="mt-1 max-w-2xl text-sm text-white/80">{hero.subtitle}</p>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="gold" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                {isAr ? 'تحرير العناوين' : 'Edit Titles'}
              </Button>
              <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <a href={`/${locale}/admin/reports/titles`}>
                  {isAr ? 'صفحة العناوين' : 'Titles page'}
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section header */}
      <div>
        <h3 className="text-lg font-semibold text-brand-teal">{section.title}</h3>
        {section.subtitle && <p className="text-sm text-muted-foreground">{section.subtitle}</p>}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label={kpiLabel('kpi_total_ideas')}
          value={kpis.totalIdeas}
          icon={BarChart3}
          accent="teal"
          series={kpis.totalSeries}
          sparklineVariant="area"
          locale={locale}
        />
        <KPICard
          label={kpiLabel('kpi_approved')}
          value={kpis.approved}
          icon={CheckCircle2}
          accent="teal"
          series={kpis.approvedSeries}
          locale={locale}
        />
        <KPICard
          label={kpiLabel('kpi_avg_score')}
          value={String(kpis.avgScore)}
          icon={Star}
          accent="gold"
          series={kpis.scoreSeries}
          locale={locale}
        />
        <KPICard
          label={kpiLabel('kpi_committee_decisions')}
          value={kpis.committeeTotal}
          icon={Gavel}
          accent="teal"
          series={kpis.committeeSeries}
          locale={locale}
        />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard titleKey="chart_a_ideas_by_status" titles={titles} locale={locale} hasData={statusData.length > 0}>
          <PieChart data={statusData} xKey="label" series={[{ key: 'value' }]} />
        </ChartCard>

        <ChartCard titleKey="chart_b_submissions_timeline" titles={titles} locale={locale} hasData={timelineData.length > 0}>
          <AreaChart
            data={timelineData}
            xKey="month"
            series={[{ key: 'count', name: isAr ? 'الأفكار' : 'Ideas' }]}
          />
        </ChartCard>

        <ChartCard titleKey="chart_c_approval_funnel" titles={titles} locale={locale} hasData={funnelHasData}>
          <FunnelChart data={funnelData} />
        </ChartCard>

        <ChartCard titleKey="chart_d_ideas_by_theme" titles={titles} locale={locale} hasData={themeData.length > 0}>
          <HBarChart data={themeData} />
        </ChartCard>

        <ChartCard titleKey="chart_e_score_distribution" titles={titles} locale={locale} hasData={scoreHasData}>
          <BarChart
            data={scoreData}
            xKey="bucket"
            series={[{ key: 'count', name: isAr ? 'التقييمات' : 'Evaluations' }]}
          />
        </ChartCard>

        <ChartCard titleKey="chart_f_time_to_decision" titles={titles} locale={locale} hasData={stageHasData}>
          <BarChart
            data={stageData}
            xKey="stage"
            series={[{ key: 'avg_days', name: isAr ? 'متوسط الأيام' : 'Avg days' }]}
          />
        </ChartCard>

        <ChartCard titleKey="chart_g_top_innovators" titles={titles} locale={locale} hasData={innovatorData.length > 0}>
          <HBarChart data={innovatorData} />
        </ChartCard>

        <ChartCard titleKey="chart_h_committee_trend" titles={titles} locale={locale} hasData={committeeData.length > 0}>
          <BarChart
            data={committeeData}
            xKey="month"
            stacked
            series={[
              { key: 'approve', name: isAr ? 'قبول' : 'Approve', color: seriesColor(0) },
              { key: 'reject', name: isAr ? 'رفض' : 'Reject', color: seriesColor(1) },
            ]}
          />
        </ChartCard>
      </div>

      {isAdmin && editing && (
        <EditTitlesModal titles={titles} locale={locale} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
