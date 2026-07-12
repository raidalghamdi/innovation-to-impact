import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import {
  getExportGenerator,
  isExportFormat,
  type ExportContext,
} from '@/lib/exports/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/exports/[format] — src/app/api/exports/[format]/route.ts:1
// Shared download endpoint for PDF/PPTX/XLSX exports. The concrete report is
// chosen by `screenId` in the body and resolved against the export registry;
// Track K registers a generator per admin/supervisor screen. Unknown screens
// answer 501 so a half-wired screen fails loudly rather than downloading junk.
//
// Body: { screenId: string, filters?: Record<string, string|number|undefined> }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  const { format } = await params;
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: 'unsupported_format' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const screenId = typeof body?.screenId === 'string' ? body.screenId : '';
  if (!screenId) {
    return NextResponse.json({ error: 'missing_screen_id' }, { status: 400 });
  }
  const filters =
    body?.filters && typeof body.filters === 'object' ? body.filters : {};

  const generator = getExportGenerator(screenId);
  if (!generator) {
    return NextResponse.json(
      { error: 'no_generator_for_screen', screenId },
      { status: 501 }
    );
  }

  const ctx: ExportContext = {
    format,
    filters,
    user: { id: user.id, email: user.email, role: user.role },
  };

  let artifact;
  try {
    artifact = await generator(ctx);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[exports] generator failed for ${screenId}/${format}:`, err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(artifact.buffer), {
    status: 200,
    headers: {
      'Content-Type': artifact.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        artifact.filename
      )}"`,
      'Cache-Control': 'no-store',
    },
  });
}
