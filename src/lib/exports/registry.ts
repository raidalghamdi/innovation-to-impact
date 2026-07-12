// Screen-keyed export registry — unified dispatch for /api/exports/[format]
// and /api/exports/send-email. Delegates to the rich chart report pipeline
// (src/lib/reports/**) for real generation.
import {
  generateScreenReport,
  isKnownScreenId,
  REPORT_SCREEN_IDS,
  type ReportFormat,
  type ReportLocale,
  MIME,
} from './registry-core';

export type ExportFormat = ReportFormat;
export const EXPORT_FORMATS: readonly ExportFormat[] = ['pdf', 'pptx', 'xlsx'];
export const CONTENT_TYPES = MIME;

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

export type ExportRequestUser = {
  id: string;
  email: string | null;
  role: string;
};

export type ExportContext = {
  format: ExportFormat;
  filters: Record<string, string | number | undefined>;
  user: ExportRequestUser;
  locale?: ReportLocale;
};

export type ExportArtifact = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export type ExportGenerator = (ctx: ExportContext) => Promise<ExportArtifact>;

// Screen titles for email subjects — pulled from screen-specs.
export function screenTitle(screenId: string): string {
  return screenId.replace(/^(admin|supervisor)\./, '').replace(/-/g, ' ');
}

// Alias for send-email route compatibility.
export const reportTitleFor = screenTitle;

// Real generator: delegates to rich chart pipeline for any known screenId.
async function realGenerator(screenId: string, ctx: ExportContext): Promise<ExportArtifact> {
  const locale: ReportLocale = ctx.locale ?? 'ar';
  const filtersStr = Object.keys(ctx.filters ?? {}).length
    ? JSON.stringify(ctx.filters)
    : undefined;
  const report = await generateScreenReport({
    screenId,
    format: ctx.format,
    locale,
    generatedBy: ctx.user.email ?? ctx.user.id,
    userId: ctx.user.id,
    filters: filtersStr,
  });
  return {
    buffer: Buffer.from(report.bytes),
    filename: report.fileName,
    contentType: report.mimeType,
  };
}

const overrides = new Map<string, ExportGenerator>();

export function registerExportGenerator(screenId: string, gen: ExportGenerator): void {
  overrides.set(screenId, gen);
}

export function getExportGenerator(screenId: string): ExportGenerator | null {
  if (overrides.has(screenId)) return overrides.get(screenId)!;
  if (isKnownScreenId(screenId)) return (ctx) => realGenerator(screenId, ctx);
  return null;
}

export const KNOWN_SCREEN_IDS = REPORT_SCREEN_IDS;
