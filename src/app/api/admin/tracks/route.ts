import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Tracks = innovation.strategic_themes. Managed by admin AND supervisor
// (getCurrentUser promotes supervisor -> admin). Both roles may add/edit/delete
// any track.

function guard(role: string | undefined) {
  return role === 'admin';
}

// GET /api/admin/tracks — list all tracks.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { data, error } = await admin
    .from('strategic_themes')
    .select('id, name_ar, name_en, description_ar, description_en')
    .order('name_en');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tracks: data ?? [] });
}

// POST /api/admin/tracks — create a track. Body: { name_ar, name_en, description_ar?, description_en? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const name_ar = String(body?.name_ar ?? '').trim();
  const name_en = String(body?.name_en ?? '').trim();
  if (!name_ar || !name_en) {
    return NextResponse.json({ error: 'name_ar and name_en are required' }, { status: 400 });
  }
  const description_ar = body?.description_ar != null ? String(body.description_ar).trim() : null;
  const description_en = body?.description_en != null ? String(body.description_en).trim() : null;

  const { data, error } = await admin
    .from('strategic_themes')
    .insert({ name_ar, name_en, description_ar, description_en })
    .select('id, name_ar, name_en, description_ar, description_en')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ track: data });
}
