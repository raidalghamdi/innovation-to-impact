import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { sendReminder } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/invitations/remind
 * Body: { ids: string[] } — send reminders to selected pending invitations.
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'no_ids' }, { status: 400 });
  }

  let reminded = 0;
  let skipped = 0;
  for (const id of ids) {
    const r = await sendReminder(id);
    if (r.ok) reminded++;
    else skipped++;
  }

  return NextResponse.json({ reminded, skipped, total: ids.length });
}
