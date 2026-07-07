import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOtp, isOtpDevMode } from '@/lib/otp';
import { getPlatformSetting } from '@/lib/db-roles';
import { validatePassword } from '@/lib/password-policy';

export const dynamic = 'force-dynamic';

// POST /api/auth/register — src/app/api/auth/register/route.ts:1
// Self-registration for a NEW user detected by /api/auth/lookup with
// state="signup". The endpoint is idempotent-safe: if the email already
// exists it returns 409 instead of silently overwriting the account.
//
// Enforced policies:
//   - external_registration_enabled must be true (admin toggle, DB-driven).
//   - Password strength policy (server-side).
//   - Basic profile fields (full_name, category) required — we cannot
//     capture them anywhere else in the new flow.
//
// After successful creation, the endpoint behaves like login-start: it
// issues an OTP and the client hops to /login/verify. This keeps the
// downstream session-establishment code path unified.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const fullName = String(body.fullName ?? '').trim();
  const department = String(body.department ?? '').trim();
  const category = String(body.category ?? 'citizen').trim();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const strength = validatePassword(password);
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'weak_password', issues: strength.issues },
      { status: 400 },
    );
  }

  const enabled = await getPlatformSetting<boolean>('external_registration_enabled', false);
  if (!enabled) {
    return NextResponse.json({ error: 'registration_closed' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // Guard against re-registration of an existing email.
  const { data: stateData } = await admin.rpc('auth_lookup_email_state', { p_email: email });
  const state = Array.isArray(stateData) ? stateData[0] : stateData;
  if (state?.user_exists) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      department: department || null,
      user_category: category,
    },
  });
  if (createErr || !created?.user) {
    return NextResponse.json({ error: 'registration_failed' }, { status: 500 });
  }

  const internalDomain = await getPlatformSetting<string>('internal_email_domain', 'gac.gov.sa');
  const isInternal = email.endsWith(`@${internalDomain}`);
  const otpRequired = await getPlatformSetting<boolean>('otp_required', true);
  if (!otpRequired) {
    return NextResponse.json({ ok: true, email, isInternal, otpSkipped: true });
  }
  const otp = await createOtp(email, 'login');
  if (!otp) {
    return NextResponse.json({ error: 'otp_failed' }, { status: 500 });
  }
  const devMode = isOtpDevMode();
  return NextResponse.json({
    ok: true,
    email,
    isInternal,
    devOtp: devMode ? otp.code : undefined,
    expiresAt: otp.expiresAt,
  });
}
