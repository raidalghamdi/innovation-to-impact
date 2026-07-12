import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/users/[id] — src/app/api/admin/users/[id]/route.ts:1
// Body: { roleIds: string[], primaryRoleId: string | null }. Admin-only.
// Phase 11.3 — replaces innovation.user_roles for the given user with the
// submitted set (checkbox list) and marks the chosen radio as primary.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !(await isCurrentUserAdmin(actor.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const roleIds: string[] = Array.isArray(body?.roleIds) ? body.roleIds : [];
  const primaryRoleId: string | null = typeof body?.primaryRoleId === 'string' ? body.primaryRoleId : null;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // Validate target user exists.
  const { data: targetUser, error: userErr } = await admin
    .from('user_profiles')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (userErr || !targetUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Replace strategy: delete all existing rows for this user, then insert the
  // submitted set. Simpler and safer than diffing, and this table is small
  // per-user (at most 5 roles).
  const { error: delErr } = await admin.from('user_roles').delete().eq('user_id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (roleIds.length > 0) {
    // Ensure at most one primary: prefer the submitted primaryRoleId if it is
    // among the checked roles, else fall back to the first checked role.
    const effectivePrimary = roleIds.includes(primaryRoleId ?? '') ? primaryRoleId : roleIds[0];
    const inserts = roleIds.map((roleId) => ({
      user_id: id,
      role_id: roleId,
      is_primary: roleId === effectivePrimary,
      assigned_by: actor.id,
    }));
    const { error: insErr } = await admin.from('user_roles').insert(inserts);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  await logAudit(actor.id, 'user.roles_changed', 'user', id, {
    after: { roleIds, primaryRoleId },
  });

  return NextResponse.json({ ok: true });
}

/**
 * PUT /api/admin/users/[id] — update profile fields.
 * Body: { full_name?, full_name_ar?, department?, phone?, organization?,
 *         user_category?, language_preference?, escalation_tier?, allowed_themes? }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !(await isCurrentUserAdmin(actor.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const allowed = [
    'full_name',
    'full_name_ar',
    'department',
    'phone',
    'organization',
    'user_category',
    'language_preference',
    'escalation_tier',
    'allowed_themes',
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const { error } = await admin
    .schema('innovation')
    .from('user_profiles')
    .update(update)
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin
    .schema('innovation')
    .from('audit_logs')
    .insert({
      user_id: actor.id,
      action: 'user.profile_updated',
      resource_type: 'user',
      resource_id: id,
      metadata: update,
    })
    .then(() => null, () => null);

  return NextResponse.json({ ok: true });
}
