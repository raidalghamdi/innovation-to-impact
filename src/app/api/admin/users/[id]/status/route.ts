import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/[id]/status
 * Body: { action: 'deactivate' | 'reactivate' | 'delete' }
 *
 * Deactivate = ban_duration = '876000h' (100y) in Supabase Auth.
 * Reactivate = ban_duration = 'none'.
 * Delete     = hard delete auth user + profile.
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
  if (id === actor.id) {
    return NextResponse.json({ error: 'cannot_modify_self' }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');

  if (action === 'deactivate') {
    const { error } = await (admin.auth.admin as any).updateUserById(id, {
      ban_duration: '876000h',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === 'reactivate') {
    const { error } = await (admin.auth.admin as any).updateUserById(id, {
      ban_duration: 'none',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === 'delete') {
    // Delete profile first (FK cascade recommended, but explicit is safer)
    await admin.schema('innovation').from('user_roles').delete().eq('user_id', id);
    await admin.schema('innovation').from('user_profiles').delete().eq('id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  await admin
    .schema('innovation')
    .from('audit_logs')
    .insert({
      user_id: actor.id,
      action: `user.${action}`,
      resource_type: 'user',
      resource_id: id,
      metadata: {},
    })
    .then(() => null, () => null);

  return NextResponse.json({ ok: true });
}
