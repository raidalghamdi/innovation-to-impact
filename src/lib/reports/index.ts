// Public entry point for the reports library. Dispatches to a query builder
// and then to a format-specific renderer. Everything else stays private.
import { buildReport } from './queries';
import { renderPdf } from './render-pdf';
import { renderXlsx } from './render-xlsx';
import { renderPptx } from './render-pptx';
import type { ReportBundle, ReportRequest } from './types';

export type { ReportBundle, ReportRequest, ReportType, ReportFormat, ReportDelivery } from './types';
export { REPORT_META, ALL_REPORT_TYPES } from './types';

export type ReportArtifact = {
  bundle: ReportBundle;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

const MIME: Record<'pdf' | 'xlsx' | 'pptx', string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function safeName(bundle: ReportBundle, format: 'pdf' | 'xlsx' | 'pptx'): string {
  const stamp = new Date(bundle.generatedAt).toISOString().slice(0, 10);
  return `i2i-${bundle.type}-${stamp}.${format}`;
}

export async function generateReport(
  req: ReportRequest,
  generatedBy: string
): Promise<ReportArtifact> {
  const bundle = await buildReport(req, generatedBy);
  let bytes: Uint8Array;
  if (req.format === 'pdf') bytes = await renderPdf(bundle, req.locale ?? 'en');
  else if (req.format === 'xlsx') bytes = await renderXlsx(bundle, req.locale ?? 'en');
  else bytes = await renderPptx(bundle, req.locale ?? 'en');
  return {
    bundle,
    bytes,
    mimeType: MIME[req.format],
    fileName: safeName(bundle, req.format),
  };
}
