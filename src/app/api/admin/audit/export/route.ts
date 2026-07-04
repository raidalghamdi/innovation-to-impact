import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { fetchAuditPage, type AuditFilters } from '@/lib/data';

export const dynamic = 'force-dynamic';

// GET /api/admin/audit/export — streams the filtered audit log as CSV.
// Admin-only. Accepts the same query params as the viewer (entityType,
// action, actorId, from, to).
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const base: AuditFilters = {
    entityType: q.get('entityType') || undefined,
    action: q.get('action') || undefined,
    actorId: q.get('actorId') || undefined,
    from: q.get('from') || undefined,
    to: q.get('to') || undefined,
    pageSize: 1000,
  };

  // Page through the full filtered result set (cap at 20k rows).
  const header = ['created_at', 'chain_seq', 'actor_id', 'actor', 'action', 'entity_type', 'entity_id', 'row_hash'];
  const lines = [header.join(',')];
  for (let page = 1; page <= 20; page++) {
    const { rows, total, pageSize, actorLabels } = await fetchAuditPage({ ...base, page });
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.chain_seq,
          r.actor_id,
          r.actor_id ? actorLabels[r.actor_id] ?? '' : '',
          r.action,
          r.entity_type,
          r.entity_id,
          r.row_hash,
        ]
          .map(csvCell)
          .join(',')
      );
    }
    if (page * pageSize >= total || rows.length === 0) break;
  }

  const csv = lines.join('\n');
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
