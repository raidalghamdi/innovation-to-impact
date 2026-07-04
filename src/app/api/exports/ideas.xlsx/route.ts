import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { ANALYTICS_ROLES } from '@/lib/roles';
import { exportIdeasWorkbook } from '@/lib/exports/xlsx';
import type { ExportFilters } from '@/lib/exports/dataset';

export const dynamic = 'force-dynamic';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// GET /api/exports/ideas.xlsx — styled multi-sheet ideas workbook. Admin+judge.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !ANALYTICS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const filters: ExportFilters = {
    status: q.get('status') || undefined,
    themeId: q.get('themeId') || undefined,
    from: q.get('from') || undefined,
    to: q.get('to') || undefined,
  };
  const locale = q.get('locale') === 'ar' ? 'ar' : 'en';

  const buffer = await exportIdeasWorkbook({
    filters,
    locale,
    generatedBy: user.fullName || user.email || user.id,
  });

  const filename = `ideas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
