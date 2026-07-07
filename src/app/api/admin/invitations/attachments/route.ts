import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/invitations/attachments — upload a file for a template.
 * Multipart form: file, template_id
 * DELETE /api/admin/invitations/attachments?id=xxx
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const templateId = form.get('template_id') as string | null;
  if (!file || !templateId) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${templateId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await admin.storage
    .from('template-attachments')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data, error } = await admin
    .schema('innovation')
    .from('email_template_attachments')
    .insert({
      template_id: templateId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: buffer.length,
      uploaded_by: user.id,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ attachment: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const { data } = await admin
    .schema('innovation')
    .from('email_template_attachments')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (data?.storage_path) {
    await admin.storage.from('template-attachments').remove([data.storage_path]);
  }
  const { error } = await admin
    .schema('innovation')
    .from('email_template_attachments')
    .delete()
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
