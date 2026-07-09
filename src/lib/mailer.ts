/**
 * Mailer — unified email sender.
 *
 * Provider selection:
 *   - If MAIL_PROVIDER is set ('smtp' | 'resend') use ONLY that provider.
 *   - Otherwise (auto): prefer Resend when RESEND_API_KEY is set, else SMTP
 *     when SMTP_HOST/SMTP_PORT are set, else no-op.
 *
 * Honesty contract: sendMail only returns ok:true when the provider actually
 * accepted the message (SMTP send resolved / Resend returned 2xx). Any thrown
 * error, non-2xx response, misconfigured forced provider, or the no-op branch
 * returns ok:false with a human-readable `error`. Resend errors are surfaced
 * verbatim (logged to stderr, first 500 chars returned to the caller).
 */
import nodemailer, { type Transporter } from 'nodemailer';

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

export type MailProvider = 'smtp' | 'resend' | 'noop';

export type SendMailResult = {
  ok: boolean;
  provider: MailProvider;
  messageId?: string;
  error?: string;
};

let smtpTransport: Transporter | null | undefined = undefined;
let smtpWarned = false;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

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
      console.warn('[mailer] SMTP not configured.');
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

function defaultFrom(): string {
  const name = process.env.MAIL_FROM_NAME ?? 'Innovation to Impact';
  const address =
    process.env.MAIL_FROM_ADDRESS ??
    process.env.RESEND_FROM ??
    'noreply@gac.gov.sa';
  return `${name} <${address}>`;
}

/**
 * Decide which provider sendMail will use given the current environment.
 * Exported so the diagnostic route can report it without sending anything.
 */
export function selectProvider(): MailProvider {
  const pref = (process.env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  if (pref === 'smtp') return 'smtp';
  if (pref === 'resend') return 'resend';
  // Auto: prefer Resend, then SMTP, then no-op.
  if (process.env.RESEND_API_KEY) return 'resend';
  if (smtpConfigured()) return 'smtp';
  return 'noop';
}

async function sendViaSmtp(
  from: string,
  to: string,
  input: SendMailInput
): Promise<SendMailResult> {
  const smtp = getSmtpTransport();
  if (!smtp) {
    return { ok: false, provider: 'smtp', error: 'SMTP selected but SMTP_HOST/SMTP_PORT are not configured' };
  }
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
    return { ok: false, provider: 'smtp', error: message };
  }
}

async function sendViaResend(
  from: string,
  input: SendMailInput
): Promise<SendMailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, provider: 'resend', error: 'RESEND_API_KEY is not set' };
  }

  const attachments = input.attachments?.map((a) => ({
    filename: a.filename,
    content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
  }));

  const payload: Record<string, unknown> = {
    from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  if (input.cc) payload.cc = input.cc;
  if (input.bcc) payload.bcc = input.bcc;
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (attachments && attachments.length > 0) payload.attachments = attachments;

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mailer] Resend request failed:', message);
    return { ok: false, provider: 'resend', error: message.slice(0, 500) };
  }

  const bodyText = await res.text();

  if (!res.ok) {
    console.error(`[mailer] Resend error ${res.status}: ${bodyText}`);
    return {
      ok: false,
      provider: 'resend',
      error: `Resend ${res.status}: ${bodyText}`.slice(0, 500),
    };
  }

  let messageId: string | undefined;
  try {
    messageId = (JSON.parse(bodyText) as { id?: string })?.id;
  } catch {
    // 2xx with a non-JSON body — still a success, just no id to report.
  }
  return { ok: true, provider: 'resend', messageId };
}

/**
 * Send an email. Never throws — returns a result object indicating provider
 * used and, on failure, a human-readable error.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = input.from ?? defaultFrom();
  const to = Array.isArray(input.to) ? input.to.join(',') : input.to;
  const provider = selectProvider();

  if (provider === 'smtp') {
    return sendViaSmtp(from, to, input);
  }
  if (provider === 'resend') {
    return sendViaResend(from, input);
  }

  // No-op — no provider configured. This must NEVER report success.
  console.error('[mailer] No email provider configured — email NOT sent to', to);
  return { ok: false, provider: 'noop', error: 'No email provider configured' };
}

/**
 * Renders a bilingual RTL-aware HTML wrapper around a body string.
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
 * Simple template renderer for {{placeholders}}. Unrecognized tokens render as
 * empty strings. Use renderTemplateTracked when you need to know which tokens
 * were missing.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  return renderTemplateTracked(template, vars).text;
}

/**
 * Like renderTemplate but also reports any {{tokens}} that had no matching
 * (non-null/defined) variable. Valid tokens are always substituted regardless
 * of missing ones — callers surface `missing` as a warning rather than failing.
 */
export function renderTemplateTracked(
  template: string,
  vars: Record<string, string | number | undefined | null>
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) {
      missing.add(key);
      return '';
    }
    return String(v);
  });
  return { text, missing: Array.from(missing) };
}
