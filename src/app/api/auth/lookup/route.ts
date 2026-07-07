import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformSetting } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// POST /api/auth/lookup — src/app/api/auth/lookup/route.ts:1
// Email-first unified auth entry. The /login screen submits ONLY the email
// as step 1, and this endpoint tells the client which UI to render next.
//
// Returned `state`:
//   - "login"    : email exists AND has a password → prompt for password
//   - "activate" : email exists but NO password (typically an imported
//                  employee who has never logged in) → prompt to set one
//   - "signup"   : email is not registered AND external self-registration
//                  is currently enabled → prompt full signup form
//   - "closed"   : email is not registered AND self-registration is disabled
//                  by the admin → show "contact admin" message
//
// The "has password" check runs via a SECURITY DEFINER RPC
// (innovation.auth_lookup_email_state) that reads auth.users.encrypted_password
// directly and returns booleans only — the hash itself never leaves Postgres.
export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({ email: '' }));
  const email = String(rawEmail ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { data, error } = await admin.rpc('auth_lookup_email_state', { p_email: email });
  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const userExists = row?.user_exists === true;
  const hasPassword = row?.has_password === true;

  if (userExists) {
    return NextResponse.json({
      ok: true,
      email,
      state: hasPassword ? 'login' : 'activate',
    });
  }

  const enabled = await getPlatformSetting<boolean>('external_registration_enabled', false);
  return NextResponse.json({
    ok: true,
    email,
    state: enabled ? 'signup' : 'closed',
  });
}
