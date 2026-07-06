import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyOtp } from '@/lib/otp';
import { getPlatformSetting } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// POST /api/auth/login-verify — src/app/api/auth/login-verify/route.ts:1
// Verifies the OTP, then establishes a real Supabase session (cookies set
// via @supabase/ssr route-handler client). On first login for an imported
// employee, mirrors innovation.employee_roles -> innovation.user_roles and
// stamps first_login_at + linked_user_id (see brief §10.2 step 8).
//
// When innovation.platform_settings.otp_required = false, `code` is optional
// and OTP verification is skipped. The setting is re-read here (source of
// truth) so a client cannot bypass OTP by lying about being skipped.
export async function POST(req: NextRequest) {
  const { email, password, code } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const otpRequired = await getPlatformSetting<boolean>('otp_required', true);
  if (otpRequired) {
    if (!code) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const result = await verifyOtp(email, 'login', code);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anonKey, {
    db: { schema: 'innovation' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const admin = createAdminClient();
  let roleCodes: string[] = [];
  let primaryRoleCode: string | null = null;

  if (admin) {
    const userId = data.user.id;

    // First-login mirror: employees -> employee_roles -> user_roles.
    const { data: employee } = await admin
      .from('employees')
      .select('id, first_login_at')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (employee && !employee.first_login_at) {
      const { data: empRoles } = await admin
        .from('employee_roles')
        .select('role_id, is_primary')
        .eq('employee_id', employee.id);

      if (empRoles && empRoles.length > 0) {
        const inserts = empRoles.map((er) => ({
          user_id: userId,
          role_id: er.role_id,
          is_primary: er.is_primary,
        }));
        await admin.from('user_roles').upsert(inserts, { onConflict: 'user_id,role_id' });
      }

      await admin
        .from('employees')
        .update({ first_login_at: new Date().toISOString(), linked_user_id: userId })
        .eq('id', employee.id);
    }

    // Load current roles (post-mirror) to decide role-selection routing.
    const { data: roleRows } = await admin
      .from('v_user_roles')
      .select('role_code, is_primary')
      .eq('user_id', userId);

    if (roleRows && roleRows.length > 0) {
      roleCodes = roleRows.map((r) => r.role_code);
      primaryRoleCode = roleRows.find((r) => r.is_primary)?.role_code ?? roleRows[0].role_code;
    }
  }

  // 0 roles -> fallback to innovator (should not normally happen for internal).
  if (roleCodes.length === 0) {
    roleCodes = ['innovator'];
    primaryRoleCode = 'innovator';
  }

  // 1 role -> auto-set active role cookie now. 2+ roles -> front-end routes to
  // /select-role, which sets the cookie once the user picks.
  if (roleCodes.length === 1) {
    response.cookies.set('i2i_active_role', roleCodes[0], {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const body = {
    ok: true,
    roles: roleCodes,
    needsRoleSelection: roleCodes.length > 1,
    activeRole: roleCodes.length === 1 ? roleCodes[0] : primaryRoleCode,
  };
  return NextResponse.json(body, { headers: response.headers });
}
