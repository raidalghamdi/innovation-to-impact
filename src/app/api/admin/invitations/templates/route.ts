import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/invitations/templates — list all templates + attachments.
 * PATCH /api/admin/invitations/templates — update a template.
 * Body (PATCH): { id, subject_ar?, subject_en?, body_ar?, body_en?, is_active? }
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { data: templates } = await admin
    .schema('innovation')
    .from('email_templates')
    .select('*')
    .order('role')
    .order('kind');

  const { data: attachments } = await admin
    .schema('innovation')
    .from('email_template_attachments')
    .select('*');

  return NextResponse.json({
    templates: templates ?? [],
    attachments: attachments ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  const fields = ['subject_ar', 'subject_en', 'body_ar', 'body_en', 'is_active'] as const;
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  const { data, error } = await admin
    .schema('innovation')
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ template: data });
}
