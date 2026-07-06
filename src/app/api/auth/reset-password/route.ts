import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password — src/app/api/auth/reset-password/route.ts:1
// Verifies the password_reset OTP, then updates the user's password via
// Supabase admin.updateUserById.
export async function POST(req: NextRequest) {
  const { email, code, newPassword } = await req.json().catch(() => ({}));
  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (String(newPassword).length < 8) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const result = await verifyOtp(email, 'password_reset', code);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { data } = await (admin.auth.admin as any).listUsers({ page: 1, perPage: 1, email });
  const targetUser = data?.users?.[0];
  if (!targetUser) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(targetUser.id, { password: newPassword });
  if (updErr) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
