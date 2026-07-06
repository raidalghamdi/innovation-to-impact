import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

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
