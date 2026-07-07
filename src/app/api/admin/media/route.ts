import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/media — list all assets
// PUT /api/admin/media — upsert (multipart form: file + metadata OR JSON with url)
// DELETE /api/admin/media?slot_key=... — remove asset row (Storage object stays)

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(req.url);
  const page = url.searchParams.get('page');

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  let q = admin
    .from('media_assets')
    .select('id,slot_key,kind,url,poster_url,alt_ar,alt_en,page,section,uploaded_at,updated_at')
    .order('page', { ascending: true })
    .order('slot_key', { ascending: true });
  if (page) q = q.eq('page', page);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const contentType = req.headers.get('content-type') || '';

  // Case A: file upload (multipart)
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const slotKey = String(form.get('slot_key') || '').trim();
    const kind = String(form.get('kind') || 'image') as 'image' | 'video';
    const page = String(form.get('page') || '') || null;
    const section = String(form.get('section') || '') || null;
    const altAr = String(form.get('alt_ar') || '') || null;
    const altEn = String(form.get('alt_en') || '') || null;

    if (!slotKey || !(file instanceof File)) {
      return NextResponse.json({ error: 'missing_file_or_slot' }, { status: 400 });
    }
    if (!['image', 'video'].includes(kind)) {
      return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
    }

    // upload to Storage
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const safeSlot = slotKey.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${safeSlot}-${Date.now()}.${ext}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage
      .from('landing-media')
      .upload(path, arrayBuf, {
        contentType: file.type || undefined,
        upsert: true,
      });
    if (uploadErr) {
      return NextResponse.json({ error: `upload_failed: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: pub } = admin.storage.from('landing-media').getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { error: upsertErr } = await admin.from('media_assets').upsert(
      {
        slot_key: slotKey,
        kind,
        url: publicUrl,
        page,
        section,
        alt_ar: altAr,
        alt_en: altEn,
        uploaded_by: user.id,
      },
      { onConflict: 'slot_key' },
    );
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, url: publicUrl });
  }

  // Case B: JSON body (metadata edit only)
  const body = await req.json().catch(() => ({}));
  const { slot_key, kind, url, poster_url, alt_ar, alt_en, page, section } = body || {};
  if (!slot_key || !kind || !url) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  const { error } = await admin.from('media_assets').upsert(
    {
      slot_key,
      kind,
      url,
      poster_url: poster_url ?? null,
      alt_ar: alt_ar ?? null,
      alt_en: alt_en ?? null,
      page: page ?? null,
      section: section ?? null,
      uploaded_by: user.id,
    },
    { onConflict: 'slot_key' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(req.url);
  const slotKey = url.searchParams.get('slot_key');
  if (!slotKey) return NextResponse.json({ error: 'missing_slot_key' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { error } = await admin.from('media_assets').delete().eq('slot_key', slotKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
