import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOtp, isOtpDevMode } from '@/lib/otp';
import { getPlatformSetting } from '@/lib/db-roles';
import { validatePassword } from '@/lib/password-policy';

export const dynamic = 'force-dynamic';

// POST /api/auth/activate — src/app/api/auth/activate/route.ts:1
// First-time password activation for a user who ALREADY exists in
// auth.users (e.g. an imported employee) but has never set a password.
// The flow mirrors login-start: set the password server-side, then issue
// an OTP that will be verified by /api/auth/login-verify (which then
// establishes the real session using the new password).
//
// Guards:
//   - Rejects if the target user doesn't exist.
//   - Rejects if the target user ALREADY has a password (must use /login
//     or /forgot-password instead — activation is one-shot).
//   - Enforces server-side password policy (source of truth).
export async function POST(req: NextRequest) {
  const { email: rawEmail, password } = await req
    .json()
    .catch(() => ({ email: '', password: '' }));
  const email = String(rawEmail ?? '').trim().toLowerCase();
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const strength = validatePassword(password);
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'weak_password', issues: strength.issues },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // Re-check state so a stale client can't force a re-activation.
  const { data: stateData, error: stateErr } = await admin.rpc('auth_lookup_email_state', {
    p_email: email,
  });
  if (stateErr) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  const state = Array.isArray(stateData) ? stateData[0] : stateData;
  if (!state?.user_exists) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
  if (state?.has_password) {
    return NextResponse.json({ error: 'already_activated' }, { status: 409 });
  }

  // Locate the user id so we can set the password via admin API.
  // listUsers is paginated; a targeted per_page=200 typically covers the
  // whole platform for our scale. If we ever grow, we can switch to a
  // by-email admin API (still not exposed cleanly in supabase-js v2).
  let userId: string | null = null;
  try {
    const { data: page, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const found = page?.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (!found) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    userId = found.id;
  } catch {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }

  // Set the password on the target user.
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (updErr) {
    return NextResponse.json({ error: 'activation_failed' }, { status: 500 });
  }

  // Now behave like login-start: issue an OTP (or skip if disabled), and
  // the client proceeds to /login/verify to complete the sign-in.
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
