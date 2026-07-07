/**
 * Mailer — unified email sender that supports:
 *   1) Custom SMTP server (preferred, controlled by SMTP_* env vars)
 *   2) Resend fallback (RESEND_API_KEY) if SMTP not configured
 *   3) No-op if neither is configured (logs warning, never throws)
 *
 * Used by the invitation system, transactional emails, and reminders.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

export type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
};

export type SendMailResult = {
  ok: boolean;
  provider: 'smtp' | 'resend' | 'noop';
  messageId?: string;
  error?: string;
};

let smtpTransport: Transporter | null | undefined = undefined;
let smtpWarned = false;
let resendWarned = false;

function getSmtpTransport(): Transporter | null {
  if (smtpTransport !== undefined) return smtpTransport;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !port) {
    smtpTransport = null;
    if (!smtpWarned) {
      smtpWarned = true;
      console.warn('[mailer] SMTP not configured — falling back to Resend or no-op.');
    }
    return null;
  }

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    // Some in-house SMTP servers use self-signed certs; allow via env
    tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : undefined,
  });

  return smtpTransport;
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!resendWarned) {
      resendWarned = true;
      console.warn('[mailer] RESEND_API_KEY not set — Resend fallback disabled.');
    }
    return null;
  }
  return new Resend(key);
}

function defaultFrom(): string {
  const name = process.env.MAIL_FROM_NAME ?? 'Innovation to Impact';
  const address =
    process.env.MAIL_FROM_ADDRESS ??
    process.env.RESEND_FROM ??
    'noreply@gac.gov.sa';
  return `${name} <${address}>`;
}

/**
 * Send an email. Never throws — returns a result object indicating provider used.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = input.from ?? defaultFrom();
  const to = Array.isArray(input.to) ? input.to.join(',') : input.to;

  // 1) Try SMTP
  const smtp = getSmtpTransport();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from,
        to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return { ok: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mailer] SMTP send failed:', message);
      // Fall through to Resend
    }
  }

  // 2) Try Resend
  const resend = getResendClient();
  if (resend) {
    try {
      const attachments = input.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
      }));
      const result = await resend.emails.send({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        cc: input.cc as string[] | string | undefined,
        bcc: input.bcc as string[] | string | undefined,
        replyTo: input.replyTo,
        attachments,
      } as any);
      return { ok: true, provider: 'resend', messageId: result.data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mailer] Resend send failed:', message);
      return { ok: false, provider: 'resend', error: message };
    }
  }

  // 3) No-op — log the message so admin sees what would have been sent
  console.warn('[mailer] No email provider configured — email NOT sent to', to);
  return { ok: false, provider: 'noop', error: 'no_provider_configured' };
}

/**
 * Renders a bilingual RTL-aware HTML wrapper around a body string.
 * Supports {{placeholders}} for template variables.
 */
export function renderMailHtml(opts: {
  subject: string;
  body: string;
  locale: 'ar' | 'en';
  brandName?: string;
  brandColor?: string;
}): string {
  const rtl = opts.locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const startSide = rtl ? 'right' : 'left';
  const brand = opts.brandName ?? (rtl ? 'الابتكار إلى الأثر' : 'Innovation to Impact');
  const color = opts.brandColor ?? '#01696F';
  // Convert plain newlines to <br> for HTML rendering
  const htmlBody = opts.body.replace(/\n/g, '<br>');
  return `<!doctype html>
<html dir="${dir}" lang="${rtl ? 'ar' : 'en'}">
  <body style="margin:0;background:#f4f6f8;padding:24px;direction:${dir};font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e9ee;direction:${dir};text-align:${align};">
      <div style="background:${color};color:#ffffff;padding:16px 20px;font-size:18px;font-weight:bold;text-align:${align};">
        ${brand}
      </div>
      <div style="padding:20px;border-${startSide}:4px solid ${color};color:#28251D;text-align:${align};">
        <h1 style="margin:0 0 12px;font-size:18px;">${opts.subject}</h1>
        <div style="margin:0;font-size:14px;line-height:1.7;color:#3b4a52;">${htmlBody}</div>
      </div>
      <div style="padding:12px 20px;background:#f9f8f5;color:#7a7974;font-size:12px;text-align:${align};">
        © ${new Date().getFullYear()} · ${brand}
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Simple template renderer for {{placeholders}}.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}
