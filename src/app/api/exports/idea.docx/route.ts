import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { generateIdeaDocx } from '@/lib/exports/docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// GET /api/exports/idea.docx?ideaId=&locale= — bilingual idea DOCX.
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

  const buffer = await generateIdeaDocx({
    ideaId,
    locale,
    generatedBy: user.fullName || user.email || user.id,
  });
  if (!buffer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const filename = `idea-${ideaId.slice(0, 8)}.docx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': DOCX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
