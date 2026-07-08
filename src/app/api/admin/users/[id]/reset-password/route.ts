import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/[id]/reset-password
 * Body: { newPassword?: string, requireChange?: boolean }
 *
 * If newPassword is provided → set it directly (admin action, no email).
 * Otherwise → default temporary password 'Demo2026!' and require change on next login.
 * requireChange defaults to true.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor || !(await isCurrentUserAdmin(actor.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const newPassword = body.newPassword?.trim() || 'Demo2026!';
  const requireChange = body.requireChange !== false;

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin
    .schema('innovation')
    .from('user_profiles')
    .update({ must_change_password: requireChange })
    .eq('id', id);

  // Audit log (best-effort)
  await admin
    .schema('innovation')
    .from('audit_logs')
    .insert({
      user_id: actor.id,
      action: 'user.password_reset',
      resource_type: 'user',
      resource_id: id,
      metadata: { require_change: requireChange, custom_password: !!body.newPassword },
    })
    .then(() => null, () => null);

  return NextResponse.json({
    ok: true,
    temporaryPassword: body.newPassword ? null : newPassword,
  });
}
