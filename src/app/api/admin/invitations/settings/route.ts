import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET/PATCH /api/admin/invitations/settings
 * Manages admin_settings keys: reminder_schedule, invitation_defaults
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const { data } = await admin.schema('innovation').from('admin_settings').select('*');
  const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  return NextResponse.json({ settings: map });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  // Accept either { key, value } or { <key1>: <value1>, <key2>: <value2>, ... }
  const rows: { key: string; value: any; updated_by: string; updated_at: string }[] = [];
  const stamp = new Date().toISOString();

  if (typeof body.key === 'string' && body.value !== undefined) {
    rows.push({ key: body.key, value: body.value, updated_by: user.id, updated_at: stamp });
  } else {
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      rows.push({ key: k, value: v, updated_by: user.id, updated_at: stamp });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const { error } = await admin
    .schema('innovation')
    .from('admin_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, updated: rows.length });
}
