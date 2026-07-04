import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { ANALYTICS_ROLES } from '@/lib/roles';
import { generateCommitteePack } from '@/lib/exports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/exports/committee-pack.pdf — body { sessionDate, ideaIds, locale? }.
// Admin+judge. Streams a bilingual committee pack PDF.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !ANALYTICS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { sessionDate?: string; ideaIds?: unknown; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ideaIds = Array.isArray(body.ideaIds)
    ? body.ideaIds.filter((v): v is string => typeof v === 'string')
    : [];
  if (!ideaIds.length) {
    return NextResponse.json({ error: 'no_ideas' }, { status: 400 });
  }

  const buffer = await generateCommitteePack({
    sessionDate: body.sessionDate || new Date().toISOString().slice(0, 10),
    ideaIds,
    locale: body.locale === 'ar' ? 'ar' : 'en',
    generatedBy: user.fullName || user.email || user.id,
  });

  const filename = `committee-pack-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
