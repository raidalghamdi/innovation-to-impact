import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/media/sign-upload
// Body: { slot_key: string, ext: string }
// Returns: { path, token, publicUrl } for direct client-side upload to
// Supabase Storage. Bypasses Vercel's 4.5MB body limit that blocks large
// video uploads through /api/admin/media.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const slotKey = String(body.slot_key || '').trim();
  const ext = String(body.ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  if (!slotKey) {
    return NextResponse.json({ error: 'missing_slot_key' }, { status: 400 });
  }

  const safeSlot = slotKey.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${safeSlot}-${Date.now()}.${ext}`;

  const { data, error } = await admin.storage
    .from('landing-media')
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'sign_failed' }, { status: 500 });
  }

  const { data: pub } = admin.storage.from('landing-media').getPublicUrl(path);
  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}
