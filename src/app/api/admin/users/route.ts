import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users  →  Create a new user (auth + profile + roles).
 *
 * Body:
 *   {
 *     email: string,           // required
 *     full_name: string,       // required
 *     full_name_ar?: string,
 *     department?: string,
 *     phone?: string,
 *     organization?: string,
 *     user_category: 'internal' | 'external',
 *     roleCodes: string[],     // e.g. ['innovator', 'supervisor']
 *     primaryRoleCode?: string,
 *     sendInvite?: boolean,    // default true → email magic link
 *     temporaryPassword?: string, // if provided, used as initial pw
 *   }
 */
export async function POST(req: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor || !(await isCurrentUserAdmin(actor.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.full_name) {
    return NextResponse.json({ error: 'email_and_name_required' }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  const userCategory = body.user_category === 'internal' ? 'internal' : 'external';

  // Internal must use @gac.gov.sa
  if (userCategory === 'internal' && !email.endsWith('@gac.gov.sa')) {
    return NextResponse.json({ error: 'internal_email_domain_required' }, { status: 400 });
  }

  const tempPw = body.temporaryPassword || 'Demo2026!';

  // 1) Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPw,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name,
      full_name_ar: body.full_name_ar ?? null,
    },
  });
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'create_failed' }, { status: 400 });
  }
  const uid = created.user.id;

  // 2) Insert profile (schema=innovation)
  const { error: profErr } = await admin
    .schema('innovation')
    .from('user_profiles')
    .upsert({
      id: uid,
      email,
      full_name: body.full_name,
      full_name_ar: body.full_name_ar ?? null,
      department: body.department ?? null,
      phone: body.phone ?? null,
      organization: body.organization ?? null,
      user_category: userCategory,
      role: body.primaryRoleCode ?? (Array.isArray(body.roleCodes) ? body.roleCodes[0] : 'innovator'),
      language_preference: body.language_preference ?? 'ar',
      must_change_password: true,
    });
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  // 3) Assign roles via innovation.user_roles
  const roleCodes: string[] = Array.isArray(body.roleCodes) && body.roleCodes.length > 0
    ? body.roleCodes
    : ['innovator'];
  const { data: roleRows } = await admin
    .schema('innovation')
    .from('roles')
    .select('id, code')
    .in('code', roleCodes);
  if (roleRows && roleRows.length > 0) {
    const primary = body.primaryRoleCode || roleCodes[0];
    const insertRows = roleRows.map((r: any) => ({
      user_id: uid,
      role_id: r.id,
      is_primary: r.code === primary,
      granted_by: actor.id,
    }));
    await admin.schema('innovation').from('user_roles').insert(insertRows);
  }

  return NextResponse.json({
    ok: true,
    user: { id: uid, email, full_name: body.full_name },
    temporaryPassword: body.sendInvite === false ? tempPw : null,
  });
}
