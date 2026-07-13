import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTopN, getPassThreshold } from '@/lib/admin-settings';

export const dynamic = 'force-dynamic';

// GET /api/admin/settings — return the R43 runtime settings (Top-N, Pass
// Threshold) from innovation.admin_settings. Any authenticated user may read
// (dashboards need the numbers); defaults are returned when unset.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [top_n, pass_threshold] = await Promise.all([getTopN(), getPassThreshold()]);
  return NextResponse.json({ top_n, pass_threshold });
}

// PUT /api/admin/settings — update the R43 runtime settings. Admin-only.
// Body: { top_n?: number, pass_threshold?: number }. Values are validated and
// upserted into innovation.admin_settings as { "value": N }.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    top_n?: unknown;
    pass_threshold?: unknown;
  };

  const updates: { key: string; value: { value: number }; updated_by: string }[] = [];

  if (body.top_n !== undefined) {
    const n = Number(body.top_n);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return NextResponse.json({ error: 'invalid_top_n' }, { status: 400 });
    }
    updates.push({ key: 'top_n', value: { value: n }, updated_by: user.id });
  }

  if (body.pass_threshold !== undefined) {
    const n = Number(body.pass_threshold);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'invalid_pass_threshold' }, { status: 400 });
    }
    updates.push({ key: 'pass_threshold', value: { value: n }, updated_by: user.id });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { error } = await admin
    .from('admin_settings')
    .upsert(updates, { onConflict: 'key' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [top_n, pass_threshold] = await Promise.all([getTopN(), getPassThreshold()]);
  return NextResponse.json({ ok: true, top_n, pass_threshold });
}

// PATCH /api/admin/settings — src/app/api/admin/settings/route.ts:1
// Body: { key: string, value: any }. Admin-only. Updates a single
// innovation.platform_settings row (upsert).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { key, value } = await req.json().catch(() => ({}));
  if (!key) {
    return NextResponse.json({ error: 'missing_key' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { error } = await admin
    .from('platform_settings')
    .upsert({ key, value, updated_by: user.id }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
