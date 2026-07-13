import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/roles/[id] — src/app/api/admin/roles/[id]/route.ts:1
// Body: any subset of { name_ar, name_en, description_ar, description_en,
// sort_order, is_active }. Admin-only. Edit-in-place for the roles catalog —
// system roles can be edited (name/description/order/active) but not deleted.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const allowedFields = ['name_ar', 'name_en', 'description_ar', 'description_en', 'sort_order', 'is_active'];
  const patch: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { data, error } = await admin.from('roles').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await logAudit(user.id, 'role.updated', 'role', id, { after: patch });
  return NextResponse.json({ ok: true, role: data });
}

// DELETE /api/admin/roles/[id] — non-system roles only, and only when not
// referenced by any user_roles / employee_roles row (FK RESTRICT would also
// catch this, but we check first to return a friendly error).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { data: role } = await admin.from('roles').select('is_system').eq('id', id).maybeSingle();
  if (!role) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (role.is_system) {
    return NextResponse.json({ error: 'system_role_protected' }, { status: 403 });
  }

  const { count: userRefCount } = await admin
    .schema('innovation').from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', id);
  const { count: empRefCount } = await admin
    .from('employee_roles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', id);

  if ((userRefCount ?? 0) > 0 || (empRefCount ?? 0) > 0) {
    return NextResponse.json({ error: 'role_in_use' }, { status: 409 });
  }

  const { error } = await admin.from('roles').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(user.id, 'role.deleted', 'role', id, { before: { is_system: role.is_system } });
  return NextResponse.json({ ok: true });
}
