import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteCommitteeCriterion } from '@/lib/committee-criteria';

export const dynamic = 'force-dynamic';

// Per-criterion mutations on innovation.committee_criteria. PUT updates by id
// (cleaner than upsertCommitteeCriterion, which keys on code); DELETE removes.

function guard(role: string | undefined) {
  return role === 'admin';
}

// PUT /api/admin/committee-criteria/[id] — update a criterion by id.
// Body: any subset of { code, name_ar, name_en, description_ar, description_en, weight, active }.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.code !== undefined) patch.code = String(body.code).trim();
  if (body?.name_ar !== undefined) patch.name_ar = String(body.name_ar).trim();
  if (body?.name_en !== undefined) patch.name_en = String(body.name_en).trim();
  if (body?.description_ar !== undefined)
    patch.description_ar = body.description_ar != null ? String(body.description_ar).trim() : null;
  if (body?.description_en !== undefined)
    patch.description_en = body.description_en != null ? String(body.description_en).trim() : null;
  if (body?.weight !== undefined) {
    const w = Number(body.weight);
    patch.weight = Number.isFinite(w) ? w : 0;
  }
  if (body?.active !== undefined) patch.active = Boolean(body.active);

  const { data, error } = await admin
    .from('committee_criteria')
    .update(patch)
    .eq('id', id)
    .select('id, code, name_ar, name_en, description_ar, description_en, weight, active')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criterion: data });
}

// DELETE /api/admin/committee-criteria/[id] — remove a criterion by id.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await deleteCommitteeCriterion(id);
  return NextResponse.json({ ok: true });
}
