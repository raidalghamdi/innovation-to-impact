import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { exportAuditWorkbook } from '@/lib/exports/xlsx';
import type { AuditFilters } from '@/lib/data';

export const dynamic = 'force-dynamic';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// GET /api/exports/audit.xlsx — formatted XLSX of the audit ledger. Admin only.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const filters: AuditFilters = {
    entityType: q.get('entityType') || undefined,
    action: q.get('action') || undefined,
    actorId: q.get('actorId') || undefined,
    from: q.get('from') || undefined,
    to: q.get('to') || undefined,
  };
  const locale = q.get('locale') === 'ar' ? 'ar' : 'en';

  const buffer = await exportAuditWorkbook({
    filters,
    locale,
    generatedBy: user.fullName || user.email || user.id,
  });

  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
