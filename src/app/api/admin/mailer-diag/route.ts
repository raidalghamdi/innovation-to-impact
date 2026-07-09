import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { selectProvider } from '@/lib/mailer';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mailer-diag
 * Admin-only. Reports which provider sendMail would use and which env vars are
 * present (never their values, except RESEND_FROM which is not a secret), plus
 * the last 5 invitation rows so the admin can confirm honest status/error text.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const provider = selectProvider();

  let last5: Array<{
    id: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }> = [];
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .schema('innovation')
      .from('invitations')
      .select('id, status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    last5 = (data as typeof last5 | null) ?? [];
  }

  return NextResponse.json({
    provider_selected: provider === 'noop' ? 'none' : provider,
    resend_api_key_present: Boolean(process.env.RESEND_API_KEY),
    resend_from_present: Boolean(process.env.RESEND_FROM),
    resend_from_value: process.env.RESEND_FROM ?? null,
    smtp_host_present: Boolean(process.env.SMTP_HOST),
    smtp_user_present: Boolean(process.env.SMTP_USER),
    mail_provider_env: process.env.MAIL_PROVIDER ?? null,
    last_5_invitations: last5,
  });
}
