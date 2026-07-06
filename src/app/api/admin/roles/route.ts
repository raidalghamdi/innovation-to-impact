import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/roles — src/app/api/admin/roles/route.ts:1
// Body: { code, name_ar, name_en, description_ar?, description_en?, sort_order? }
// Admin-only. Creates a new (non-system) role.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase().replace(/\s+/g, '_') : '';
  const name_ar = typeof body?.name_ar === 'string' ? body.name_ar.trim() : '';
  const name_en = typeof body?.name_en === 'string' ? body.name_en.trim() : '';
  if (!code || !name_ar || !name_en) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('roles')
    .insert({
      code,
      name_ar,
      name_en,
      description_ar: body?.description_ar ?? null,
      description_en: body?.description_en ?? null,
      sort_order: typeof body?.sort_order === 'number' ? body.sort_order : 100,
      is_system: false,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, role: data });
}
