import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { generateIdeaBrief } from '@/lib/exports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/exports/idea-brief.pdf?ideaId=&locale= — single-idea PDF brief.
// Any authenticated user (RLS on the underlying idea query enforces access).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ideaId = req.nextUrl.searchParams.get('ideaId');
  if (!ideaId) {
    return NextResponse.json({ error: 'missing_ideaId' }, { status: 400 });
  }
  const locale = req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en';

  const buffer = await generateIdeaBrief({
    ideaId,
    locale,
    generatedBy: user.fullName || user.email || user.id,
  });
  if (!buffer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const filename = `idea-brief-${ideaId.slice(0, 8)}.pdf`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
