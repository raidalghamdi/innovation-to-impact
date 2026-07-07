import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/phases — list all 7 phases with schedule
// PATCH /api/admin/phases — body: { idx, starts_at, ends_at }

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { data, error } = await admin
    .from('phase_schedule')
    .select('idx,code,label_ar,label_en,starts_at,ends_at,updated_at')
    .order('idx', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phases: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { idx, starts_at, ends_at } = body || {};
  if (typeof idx !== 'number' || idx < 0 || idx > 6) {
    return NextResponse.json({ error: 'invalid_idx' }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const patch: Record<string, unknown> = { updated_by: user.id };
  if (starts_at !== undefined) patch.starts_at = starts_at || null;
  if (ends_at !== undefined) patch.ends_at = ends_at || null;

  const { error } = await admin
    .from('phase_schedule')
    .update(patch)
    .eq('idx', idx);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
