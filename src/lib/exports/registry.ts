// Screen-keyed export registry — the shared dispatch table both export routes
// (/api/exports/[format] and /api/exports/send-email) resolve against.
//
// Track K registers a real generator per admin/supervisor screen via
// registerExportGenerator(). This file only ships the scaffold plus a few
// placeholder stubs (analytics, ideas, users) so the plumbing is exercisable
// end-to-end before the domain screens land. An unknown screenId resolves to
// null and the routes answer 501.

export type ExportFormat = 'pdf' | 'pptx' | 'xlsx';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['pdf', 'pptx', 'xlsx'];

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

// Minimal identity of the requester, forwarded from the route's session so a
// generator can scope data (e.g. supervisor-owned tracks) without re-reading
// the session itself.
export type ExportRequestUser = {
  id: string;
  email: string | null;
  role: string;
};

export type ExportContext = {
  format: ExportFormat;
  filters: Record<string, string | number | undefined>;
  user: ExportRequestUser;
};

export type ExportArtifact = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export type ExportGenerator = (ctx: ExportContext) => Promise<ExportArtifact>;

// Human-readable report titles per screen, used to build the email subject
// (`[GAC I2I] {title} — {date}`) and download filenames. Track K can extend
// this alongside registerExportGenerator().
const SCREEN_TITLES: Record<string, string> = {
  'admin.analytics': 'Analytics',
  'admin.ideas': 'Ideas',
  'admin.users': 'Users',
};

export function reportTitleFor(screenId: string): string {
  return SCREEN_TITLES[screenId] ?? screenId;
}

export function registerReportTitle(screenId: string, title: string): void {
  SCREEN_TITLES[screenId] = title;
}

const registry = new Map<string, ExportGenerator>();

// Track K calls this (typically from module-load side effects) to wire a real
// generator for a screen. Later registrations win, so a screen can be
// overridden in tests.
export function registerExportGenerator(screenId: string, generator: ExportGenerator): void {
  registry.set(screenId, generator);
}

export function getExportGenerator(screenId: string): ExportGenerator | null {
  return registry.get(screenId) ?? null;
}

export function registeredScreens(): string[] {
  return [...registry.keys()];
}

// --- Placeholder stubs -----------------------------------------------------
// These emit a tiny text payload under the requested format's extension so the
// download/email path can be exercised. Track K replaces each with a real
// pdf-lib / pptxgenjs / exceljs generator.

const EXTENSIONS: Record<ExportFormat, string> = { pdf: 'pdf', pptx: 'pptx', xlsx: 'xlsx' };

function stubGenerator(screenId: string): ExportGenerator {
  return async (ctx) => {
    const title = reportTitleFor(screenId);
    const date = new Date().toISOString().slice(0, 10);
    const note =
      `Placeholder ${ctx.format.toUpperCase()} export for "${title}" (${screenId}).\n` +
      `Generated ${date}. Filters: ${JSON.stringify(ctx.filters)}.\n` +
      `A real generator for this screen has not been registered yet.`;
    return {
      buffer: Buffer.from(note, 'utf-8'),
      filename: `${screenId}-${date}.${EXTENSIONS[ctx.format]}`,
      contentType: CONTENT_TYPES[ctx.format],
    };
  };
}

registerExportGenerator('admin.analytics', stubGenerator('admin.analytics'));
registerExportGenerator('admin.ideas', stubGenerator('admin.ideas'));
registerExportGenerator('admin.users', stubGenerator('admin.users'));
