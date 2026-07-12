import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function guard(role: string | undefined) {
  return role === 'admin';
}

// PATCH /api/admin/tracks/[id] — edit a track.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Record<string, string> = {};
  if (typeof body?.name_ar === 'string') patch.name_ar = body.name_ar.trim();
  if (typeof body?.name_en === 'string') patch.name_en = body.name_en.trim();
  if (typeof body?.description_ar === 'string') patch.description_ar = body.description_ar.trim();
  if (typeof body?.description_en === 'string') patch.description_en = body.description_en.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('strategic_themes')
    .update(patch)
    .eq('id', id)
    .select('id, name_ar, name_en, description_ar, description_en')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ track: data });
}

// DELETE /api/admin/tracks/[id] — delete a track. Ideas referencing it have
// their strategic_theme_id set to null (FK on delete set null).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { id } = await params;
  const { error } = await admin.from('strategic_themes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
