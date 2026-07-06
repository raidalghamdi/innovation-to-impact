import { createHash, randomInt } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformSetting } from '@/lib/db-roles';
import { sendOtpMessage } from '@/lib/messaging';

/**
 * OTP core — src/lib/otp.ts
 * Generates, hashes, stores and verifies one-time codes in
 * innovation.otp_codes (service-role only table, see migration 00021).
 *
 * DEV MODE: when NEXT_PUBLIC_OTP_DEV_MODE is not explicitly 'false', the raw
 * OTP is (a) logged via console.error('[DEV OTP]', ...) and (b) returned to
 * the caller so the API route can surface it in the JSON response for local/
 * preview testing. This must never be relied on in production — real email
 * delivery is out of scope for this batch (see brief §Non-goals).
 */

export function isOtpDevMode(): boolean {
  return process.env.NEXT_PUBLIC_OTP_DEV_MODE !== 'false';
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(length: number): string {
  const max = 10 ** length;
  const n = randomInt(0, max);
  return String(n).padStart(length, '0');
}

export type OtpPurpose = 'login' | 'password_reset' | 'email_verify';

/**
 * Creates and stores a new OTP for the given email + purpose. Returns the
 * plaintext code ONLY to the caller (never persisted in plaintext) so the
 * API route can decide whether to surface it (dev mode) or dispatch it via
 * email (production — not yet wired, see console.error fallback below).
 */
export async function createOtp(email: string, purpose: OtpPurpose): Promise<{ code: string; expiresAt: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const otpLength = await getPlatformSetting<number>('otp_length', 6);
  const ttlMinutes = await getPlatformSetting<number>('otp_ttl_minutes', 10);
  const maxAttempts = await getPlatformSetting<number>('otp_max_attempts', 5);

  const code = generateCode(otpLength);
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  // Invalidate any prior un-consumed OTPs of the same purpose for this email
  // so only the latest code is valid (prevents stale-code confusion).
  await admin
    .from('otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email.toLowerCase())
    .eq('purpose', purpose)
    .is('consumed_at', null);

  const { error } = await admin.from('otp_codes').insert({
    email: email.toLowerCase(),
    code_hash: codeHash,
    purpose,
    expires_at: expiresAt,
    max_attempts: maxAttempts,
  });
  if (error) return null;

  // Email delivery infra is out of scope for this batch (see brief). Log to
  // stderr so it is retrievable from server logs during development/QA.
  console.error('[DEV OTP]', email, code, `(purpose=${purpose}, expires ${expiresAt})`);

  // Best-effort WhatsApp OTP delivery. Fully gated by platform_settings
  // (whatsapp_enabled + whatsapp_channels.otp). Never throws — falls back to
  // the console/email paths above if the recipient has no phone on file or
  // the provider is disabled.
  const phone = await lookupRecipientPhone(admin, email);
  if (phone) {
    await sendOtpMessage({
      phoneE164: phone,
      code,
      ttlMinutes,
    });
  }

  return { code, expiresAt };
}

// Resolve the phone number for an OTP recipient. Checks innovation.employees
// first (internal users), falls back to user_profiles. Returns null if neither
// has a phone recorded.
async function lookupRecipientPhone(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string
): Promise<string | null> {
  try {
    const normalized = email.toLowerCase();
    const { data: emp } = await admin
      .from('employees')
      .select('phone')
      .eq('email', normalized)
      .maybeSingle();
    const empPhone = (emp as { phone?: string | null } | null)?.phone;
    if (empPhone) return empPhone;

    const { data: prof } = await admin
      .from('user_profiles')
      .select('phone')
      .eq('email', normalized)
      .maybeSingle();
    const profPhone = (prof as { phone?: string | null } | null)?.phone;
    return profPhone ?? null;
  } catch {
    return null;
  }
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

/** Verifies a submitted OTP code. Increments attempts on mismatch; marks consumed on success. */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<OtpVerifyResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: 'not_found' };

  const { data: row, error } = await admin
    .from('otp_codes')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) return { ok: false, reason: 'not_found' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  if (row.attempts >= row.max_attempts) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const hash = hashOtp(code);
  if (hash !== row.code_hash) {
    await admin
      .from('otp_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    return { ok: false, reason: 'mismatch' };
  }

  await admin.from('otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true };
}
