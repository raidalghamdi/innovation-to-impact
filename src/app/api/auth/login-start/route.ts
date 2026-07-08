import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createOtp, isOtpDevMode } from '@/lib/otp';
import { getPlatformSetting } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// POST /api/auth/login-start — src/app/api/auth/login-start/route.ts:1
// Verifies email+password via Supabase auth WITHOUT establishing a session,
// then issues a login OTP. Both internal (@gac.gov.sa) and external users
// go through OTP — no exceptions (see brief §10.2).
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({ email: '', password: '' }));
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // Session-less password check: a throwaway client with persistSession off.
  const verifier = createSupabaseClient(url, anonKey, {
    db: { schema: 'innovation' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  // Immediately drop this throwaway session — we don't want it lingering.
  await verifier.auth.signOut().catch(() => {});

  const internalDomain = await getPlatformSetting<string>('internal_email_domain', 'gac.gov.sa');
  const isInternal = email.toLowerCase().endsWith(`@${internalDomain}`);

  // Admin can disable OTP entirely (demo / testing shortcut). When disabled,
  // login-start does not create a code and the client is instructed to POST
  // straight to /api/auth/login-verify (which re-reads the setting server-
  // side, so the client cannot bypass by lying).
  const otpRequired = await getPlatformSetting<boolean>('otp_required', false);
  if (!otpRequired) {
    return NextResponse.json({
      ok: true,
      email,
      isInternal,
      otpSkipped: true,
    });
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
    // DEV ONLY: surfaces the OTP so QA/dev can proceed without email infra.
    // Must never be relied upon in production — real delivery is out of
    // scope for this batch (see brief §Non-goals).
    devOtp: devMode ? otp.code : undefined,
    expiresAt: otp.expiresAt,
  });
}
