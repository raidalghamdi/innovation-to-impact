// Registry wiring the rich, chart-driven screen reports end-to-end for all 18
// screenIds (9 admin + 9 supervisor). Each generator:
//   1. loads live per-screen chart data  (data/live-queries.screenDataLoader)
//   2. resolves localized titles          (i18n defaults ⊕ report_titles overrides)
//   3. assembles the requested format      (rich-pdf / rich-pptx / rich-xlsx)
//
// New sibling module — it does not touch the existing exports/reports code.
import enMessages from '../../../messages/en.json';
import arMessages from '../../../messages/ar.json';
import {
  SCREEN_SPECS,
  getScreenSpec,
  ALL_SCREEN_IDS,
  type ScreenSpec,
} from '@/lib/reports/screen-specs';
import { screenDataLoader, type Scope, type ScreenData } from '@/lib/reports/data/live-queries';
import { getReportTitles, resolveTitle, type TitleOverride } from '@/lib/reports/titles/report-titles';
import { renderRichPdf } from '@/lib/reports/pdf/rich-pdf';
import { renderRichPptx } from '@/lib/reports/pptx/rich-pptx';
import { renderRichXlsx } from '@/lib/reports/xlsx/rich-xlsx';

export type ReportFormat = 'pdf' | 'pptx' | 'xlsx';
export type ReportLocale = 'ar' | 'en';

export const MIME: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Resolve a dot-path (e.g. "reports.analytics.charts.ideasByStage.title") in the
// bundled messages JSON. Returns undefined when any segment is missing.
function dotGet(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function messagesFor(locale: ReportLocale): unknown {
  return locale === 'ar' ? arMessages : enMessages;
}

// i18n default for a chart title: `reports.<screen>.charts.<chartId>.title`,
// falling back to the chart id when no key exists yet.
function i18nChartTitle(chartTitleKey: string, chartId: string, locale: ReportLocale): string {
  return dotGet(messagesFor(locale), chartTitleKey) ?? chartId;
}

function i18nScreenTitle(spec: ScreenSpec, locale: ReportLocale): string {
  return dotGet(messagesFor(locale), spec.titleKey) ?? spec.titleKey;
}

function i18nScreenSubtitle(spec: ScreenSpec, locale: ReportLocale): string | undefined {
  const key = spec.titleKey.replace(/\.title$/, '.subtitle');
  return dotGet(messagesFor(locale), key);
}

function scopeOf(screenId: string): Scope {
  return screenId.startsWith('supervisor.') ? 'supervisor' : 'admin';
}

export type GenerateInput = {
  screenId: string;
  format: ReportFormat;
  locale: ReportLocale;
  generatedBy: string;
  userId?: string;
  filters?: string;
  generatedAt?: string;
};

export type GeneratedReport = {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

function safeName(screenId: string, format: ReportFormat, generatedAt: string): string {
  const flat = screenId.replace(/[^a-zA-Z0-9]+/g, '-');
  const stamp = new Date(generatedAt).toISOString().slice(0, 10);
  return `i2i-${flat}-${stamp}.${format}`;
}

// Resolve every chart's effective localized title (override → i18n default).
async function resolveChartTitles(
  screenId: string,
  spec: ScreenSpec,
  locale: ReportLocale
): Promise<Record<string, string>> {
  const overrides: Record<string, TitleOverride> = await getReportTitles(screenId).catch(() => ({}));
  const out: Record<string, string> = {};
  for (const chart of spec.charts) {
    const fallback = i18nChartTitle(chart.titleKey, chart.id, locale);
    out[chart.id] = resolveTitle(overrides[chart.id], fallback, locale);
  }
  return out;
}

export async function generateScreenReport(input: GenerateInput): Promise<GeneratedReport> {
  const spec = getScreenSpec(input.screenId);
  if (!spec) throw new Error(`Unknown screenId: ${input.screenId}`);

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const loader = screenDataLoader(input.screenId);
  const data: ScreenData = await loader(scopeOf(input.screenId), input.userId);
  const chartTitles = await resolveChartTitles(input.screenId, spec, input.locale);
  const title = i18nScreenTitle(spec, input.locale);
  const subtitle = i18nScreenSubtitle(spec, input.locale);

  let bytes: Uint8Array;
  if (input.format === 'pdf') {
    bytes = await renderRichPdf({
      screenId: input.screenId,
      spec,
      data,
      locale: input.locale,
      title,
      subtitle,
      generatedBy: input.generatedBy,
      generatedAt,
      filters: input.filters,
      chartTitles,
    });
  } else if (input.format === 'pptx') {
    bytes = await renderRichPptx({
      screenId: input.screenId,
      spec,
      data,
      locale: input.locale,
      title,
      subtitle,
      generatedBy: input.generatedBy,
      generatedAt,
      filters: input.filters,
      chartTitles,
    });
  } else {
    bytes = await renderRichXlsx({
      spec,
      data,
      title,
      generatedBy: input.generatedBy,
      generatedAt,
      chartTitles,
    });
  }

  return {
    bytes,
    mimeType: MIME[input.format],
    fileName: safeName(input.screenId, input.format, generatedAt),
  };
}

// Table of every screenId a caller may generate (admin.* + supervisor.*).
export const REPORT_SCREEN_IDS: string[] = ALL_SCREEN_IDS;

export function isKnownScreenId(screenId: string): boolean {
  return screenId in SCREEN_SPECS;
}
