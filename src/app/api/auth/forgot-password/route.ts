import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOtp, isOtpDevMode } from '@/lib/otp';

export const dynamic = 'force-dynamic';

// POST /api/auth/forgot-password — src/app/api/auth/forgot-password/route.ts:1
// Issues a password_reset OTP if the email belongs to a known auth user.
// Always returns ok:true (does not leak whether the email exists) except in
// dev mode, where the OTP is surfaced for local/preview testing.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: '' }));
  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const admin = createAdminClient();
  let userExists = false;
  if (admin) {
    // listUsers with a filter isn't available on the JS client; use the
    // admin REST endpoint via auth.admin.listUsers and filter client-side
    // for small user bases, or getUserByEmail equivalent when available.
    try {
      const { data } = await (admin.auth.admin as any).listUsers({ page: 1, perPage: 1, email });
      userExists = Boolean(data?.users?.length);
    } catch {
      userExists = true; // fail open on the check; OTP verify still gates actual reset
    }
  }

  const otp = userExists ? await createOtp(email, 'password_reset') : null;
  const devMode = isOtpDevMode();

  return NextResponse.json({
    ok: true,
    devOtp: devMode && otp ? otp.code : undefined,
  });
}
