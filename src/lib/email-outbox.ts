/**
 * Durable email queue helper.
 *
 * Every transactional email goes through here. Behavior:
 *   1) Always inserts a row into innovation.email_outbox (via SECURITY DEFINER
 *      RPC fn_enqueue_email). This means we never lose track of a notification
 *      even when SMTP/Resend isn't configured yet.
 *   2) If RESEND_API_KEY or SMTP_HOST is present, tries to send immediately and
 *      updates the row to 'sent' / 'failed'. If neither is configured, the row
 *      stays 'pending' — a worker or manual flush can pick it up later.
 *
 * This is intentionally best-effort and NEVER throws. Notification code can
 * call enqueueEmail() without try/catch.
 *
 * ENV VARS (all optional):
 *   RESEND_API_KEY  — preferred; if set, Resend is used
 *   SMTP_HOST       — fallback SMTP host (e.g. smtp.gmail.com)
 *   SMTP_PORT       — default 587
 *   SMTP_USER
 *   SMTP_PASS
 *   EMAIL_FROM      — e.g. 'i2i <no-reply@example.com>'
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export type EmailCategory =
  | 'notification'
  | 'team_invite'
  | 'idea_status'
  | 'evaluation_ready'
  | 'account';

export type EnqueueEmailInput = {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  category?: EmailCategory;
  toUserId?: string | null;
  metadata?: Record<string, unknown>;
};

const FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? 'i2i <onboarding@resend.dev>';

let warnedNoTransport = false;

function haveResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}
function haveSmtp(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

async function persist(row: EnqueueEmailInput): Promise<string | null> {
  try {
    const svc = createAdminClient();
    if (!svc) return null;
    // SECURITY DEFINER RPC returns the outbox id.
    const { data, error } = await svc.rpc('fn_enqueue_email', {
      p_to_email: row.to,
      p_subject: row.subject,
      p_body_html: row.bodyHtml,
      p_body_text: row.bodyText ?? null,
      p_category: row.category ?? 'notification',
      p_to_user_id: row.toUserId ?? null,
      p_metadata: row.metadata ?? {},
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[email-outbox] persist failed:', error.message);
      return null;
    }
    return typeof data === 'string' ? data : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[email-outbox] persist error:', err);
    return null;
  }
}

async function markStatus(id: string, status: 'sent' | 'failed', lastError?: string) {
  try {
    const svc = createAdminClient();
    if (!svc) return;
    await svc
      .from('email_outbox')
      .update({
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        last_error: lastError ?? null,
      })
      .eq('id', id);
  } catch {
    // best-effort
  }
}

async function sendViaResend(row: EnqueueEmailInput): Promise<void> {
  const key = process.env.RESEND_API_KEY!;
  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    to: row.to,
    subject: row.subject,
    html: row.bodyHtml,
    text: row.bodyText,
  });
}

async function sendViaSmtp(row: EnqueueEmailInput): Promise<void> {
  // Dynamic import behind a variable so webpack cannot statically resolve
  // (and therefore cannot fail the build on) an optional dependency that may
  // not be installed. If nodemailer isn't installed, this throws at runtime
  // and callers fall through to 'pending' — see enqueueEmail().
  const pkg = 'nodemailer';
  const nodemailer = await import(/* webpackIgnore: true */ pkg);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: FROM,
    to: row.to,
    subject: row.subject,
    html: row.bodyHtml,
    text: row.bodyText,
  });
}

/**
 * Enqueue-and-try-send. Never throws.
 * Returns the outbox row id (if persistence succeeded) or null.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<string | null> {
  const id = await persist(input);

  if (!haveResend() && !haveSmtp()) {
    if (!warnedNoTransport) {
      warnedNoTransport = true;
      // eslint-disable-next-line no-console
      console.info(
        '[email-outbox] no RESEND_API_KEY or SMTP_* configured — email queued as pending.',
      );
    }
    return id;
  }

  try {
    if (haveResend()) await sendViaResend(input);
    else await sendViaSmtp(input);
    if (id) await markStatus(id, 'sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[email-outbox] send failed:', msg);
    if (id) await markStatus(id, 'failed', msg);
  }
  return id;
}

/** Minimal bilingual HTML template — RTL-safe, brand-teal accent. */
export function renderBilingualEmailHtml(opts: {
  titleAr: string;
  titleEn: string;
  bodyHtmlAr: string;
  bodyHtmlEn: string;
  ctaHref?: string;
  ctaLabelAr?: string;
  ctaLabelEn?: string;
}): string {
  const cta =
    opts.ctaHref && opts.ctaLabelAr && opts.ctaLabelEn
      ? `<div style="text-align:center;margin:20px 0;">
        <a href="${opts.ctaHref}" style="display:inline-block;padding:12px 24px;background:#01696F;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          ${opts.ctaLabelAr} / ${opts.ctaLabelEn}
        </a>
      </div>`
      : '';
  return `<!doctype html>
<html dir="ltr" lang="en">
<body style="margin:0;background:#f4f6f8;padding:24px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e9ee;">
    <div style="background:#01696F;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold;">
      i2i · الابتكار إلى الأثر
    </div>
    <div dir="rtl" style="padding:20px;text-align:right;color:#28251D;border-right:4px solid #01696F;">
      <h2 style="margin:0 0 12px;font-size:16px;">${opts.titleAr}</h2>
      <div style="font-size:14px;line-height:1.7;color:#3b4a52;">${opts.bodyHtmlAr}</div>
    </div>
    <div style="border-top:1px solid #e5e9ee;"></div>
    <div dir="ltr" style="padding:20px;text-align:left;color:#28251D;border-left:4px solid #01696F;">
      <h2 style="margin:0 0 12px;font-size:16px;">${opts.titleEn}</h2>
      <div style="font-size:14px;line-height:1.7;color:#3b4a52;">${opts.bodyHtmlEn}</div>
    </div>
    ${cta}
  </div>
</body>
</html>`;
}
