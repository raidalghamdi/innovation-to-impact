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
import { applyTestRedirect } from '@/lib/email-redirect';
import { createAdminClient } from '@/lib/supabase/admin';

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
  // Optional link back to the domain entity that triggered this email
  // (e.g. an idea). Recorded on innovation.email_log for auditability.
  relatedEntity?: { type: string; id: string };
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
  const name = process.env.MAIL_FROM_NAME ?? 'GAC Innovation Program';
  const explicitAddress = process.env.MAIL_FROM_ADDRESS;
  if (explicitAddress) {
    return `${name} <${explicitAddress}>`;
  }
  const resendFrom = process.env.RESEND_FROM?.trim();
  if (resendFrom) {
    // Pass through if already formatted (`Name <email>`), else wrap.
    return resendFrom.includes('<') ? resendFrom : `${name} <${resendFrom}>`;
  }
  return `${name} <noreply@gac.gov.sa>`;
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

function toDisplay(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : String(to);
}

/**
 * Write one audit row per send attempt to innovation.email_log. Best-effort:
 * a logging failure must never break email delivery, so everything is wrapped
 * in try/catch and only console.error'd.
 */
async function logEmailAttempt(entry: {
  toOriginal: string;
  toFinal: string;
  from: string;
  subject: string;
  redirectApplied: boolean;
  relatedEntity?: { type: string; id: string };
  result: SendMailResult;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from('email_log').insert({
      to_original: entry.toOriginal.slice(0, 500),
      to_final: entry.toFinal.slice(0, 500),
      from_addr: entry.from.slice(0, 500),
      subject: entry.subject.slice(0, 500),
      provider: entry.result.provider,
      status: entry.result.ok ? 'ok' : entry.result.provider === 'noop' ? 'noop' : 'error',
      provider_message_id: entry.result.messageId ?? null,
      error: entry.result.error ? entry.result.error.slice(0, 500) : null,
      redirect_applied: entry.redirectApplied,
      related_entity_type: entry.relatedEntity?.type ?? null,
      related_entity_id: entry.relatedEntity?.id ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mailer] email_log insert failed:', err);
  }
}

/**
 * Send an email. Never throws — returns a result object indicating provider
 * used and, on failure, a human-readable error. Every attempt is recorded on
 * innovation.email_log (after the test-redirect is applied so both the
 * original and final recipients are captured).
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = input.from ?? defaultFrom();
  const relatedEntity = input.relatedEntity;

  const toOriginal = toDisplay(input.to);

  // TEST-ONLY: reroute mail addressed to a matching recipient (see email-redirect.ts).
  const redirected = applyTestRedirect(input.to, input.subject);
  input = { ...input, to: redirected.to, subject: redirected.subject };

  const toFinal = toDisplay(input.to);
  const redirectApplied = toFinal !== toOriginal;

  const to = Array.isArray(input.to) ? input.to.join(',') : input.to;
  const provider = selectProvider();

  let result: SendMailResult;
  if (provider === 'smtp') {
    result = await sendViaSmtp(from, to, input);
  } else if (provider === 'resend') {
    result = await sendViaResend(from, input);
  } else {
    // No-op — no provider configured. This must NEVER report success.
    console.error('[mailer] No email provider configured — email NOT sent to', to);
    result = { ok: false, provider: 'noop', error: 'No email provider configured' };
  }

  await logEmailAttempt({
    toOriginal,
    toFinal,
    from,
    subject: input.subject,
    redirectApplied,
    relatedEntity,
    result,
  });

  return result;
}

/** Minimal HTML-escape for values interpolated into email markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isBlank(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === '';
}

/**
 * Renders the branded "Competition Innovation Program" invitation email.
 *
 * Ported from the approved mockup (dark-teal header, white logo, optional
 * info box, dual CTA, gold-accented footer slogan). All styling is inline —
 * email clients do not reliably honour <style> blocks. The header title is
 * intentionally Arabic regardless of locale, matching the approved design.
 *
 * Optional sections collapse when their inputs are absent:
 *   - logo image: omitted when `logoUrl` is blank
 *   - meta strip: omitted when `metaItems` is empty
 *   - optional info box: omitted when BOTH title and body are blank
 *   - CTA row: omitted when neither `acceptUrl` nor `rejectUrl` is provided
 *     (falls back to plain body text, used by reminders/accept/reject mails)
 */
export function renderMailHtml(opts: {
  subject: string;
  body: string;
  locale: 'ar' | 'en';
  brandName?: string; // kept for backward-compat; unused in new template
  brandColor?: string; // kept for backward-compat; unused in new template
  logoUrl?: string;
  acceptUrl?: string;
  rejectUrl?: string;
  metaItems?: Array<{ label: string; value: string }>;
  extraInfoTitle?: string;
  extraInfoBody?: string;
  greetingName?: string;
  deadlineText?: string;
  // Optional CTA button labels. Default to the invitation wording
  // ("قبول الدعوة" / "اعتذار") so existing callers are unaffected; other
  // flows (e.g. idea-submission confirmation) can override with their own copy.
  acceptLabel?: string;
  rejectLabel?: string;
}): string {
  const rtl = opts.locale !== 'en';
  const dir = rtl ? 'rtl' : 'ltr';

  const subject = escapeHtml(opts.subject ?? '');
  const htmlBody = escapeHtml(opts.body ?? '').replace(/\n/g, '<br>');

  // --- Header logo ----------------------------------------------------------
  const logo = !isBlank(opts.logoUrl)
    ? `<img src="${escapeHtml(opts.logoUrl!.trim())}" alt="برنامج ابتكار المنافسة" height="68" style="height:68px;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`
    : '';

  // --- Greeting -------------------------------------------------------------
  const greetName = !isBlank(opts.greetingName) ? opts.greetingName!.trim() : opts.subject;
  const greeting = !isBlank(greetName)
    ? `<div style="font-size:18px;font-weight:600;color:#1C4854;margin:0 0 12px;">مرحباً ${escapeHtml(greetName)}،</div>`
    : '';

  // --- Meta strip -----------------------------------------------------------
  const metaItems = (opts.metaItems ?? []).filter(
    (m) => m && !isBlank(m.label) && !isBlank(m.value)
  );
  let metaStrip = '';
  if (metaItems.length > 0) {
    const cells = metaItems
      .map(
        (m, i) => `${
          i > 0
            ? '<td style="width:1px;padding:0;"><div style="width:1px;height:32px;background:#E0D9C4;"></div></td>'
            : ''
        }<td style="padding:0 8px;vertical-align:middle;text-align:${rtl ? 'right' : 'left'};">
              <div style="font-size:12px;color:#7A7974;margin-bottom:4px;font-weight:500;">${escapeHtml(
                m.label
              )}</div>
              <div style="font-size:15px;color:#232529;font-weight:600;">${escapeHtml(m.value)}</div>
            </td>`
      )
      .join('');
    metaStrip = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F7F5EF;border:1px solid #EFE9DA;border-radius:12px;margin:20px 0 24px;">
          <tr><td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells}</tr></table>
          </td></tr>
        </table>`;
  }

  // --- Optional info box ----------------------------------------------------
  // Hidden entirely when BOTH title and body are blank.
  let optionalBox = '';
  if (!isBlank(opts.extraInfoTitle) || !isBlank(opts.extraInfoBody)) {
    const titleHtml = !isBlank(opts.extraInfoTitle)
      ? `<div style="font-size:12px;color:#1C4854;font-weight:700;letter-spacing:0.4px;margin-bottom:6px;">◆ ${escapeHtml(
          opts.extraInfoTitle!.trim()
        )}</div>`
      : '';
    const bodyHtml = !isBlank(opts.extraInfoBody)
      ? `<div style="font-size:14px;color:#3B4A52;line-height:1.7;">${escapeHtml(
          opts.extraInfoBody!.trim()
        ).replace(/\n/g, '<br>')}</div>`
      : '';
    optionalBox = `<div style="background:#F0F9FB;border-${rtl ? 'right' : 'left'}:4px solid #3FBAC8;border-radius:10px;padding:16px 20px;margin:8px 0 24px;">${titleHtml}${bodyHtml}</div>`;
  }

  // --- CTA row / body -------------------------------------------------------
  const hasAccept = !isBlank(opts.acceptUrl);
  const hasReject = !isBlank(opts.rejectUrl);
  let ctaBlock = '';
  if (hasAccept || hasReject) {
    const btns: string[] = [];
    const acceptLabel = !isBlank(opts.acceptLabel) ? opts.acceptLabel!.trim() : 'قبول الدعوة';
    const rejectLabel = !isBlank(opts.rejectLabel) ? opts.rejectLabel!.trim() : 'اعتذار';
    // Single-CTA layout: when only the accept button is present it spans the
    // full width instead of hugging half the row.
    const btnWidth = hasAccept && hasReject ? '50%' : '100%';
    if (hasAccept) {
      btns.push(`<td style="padding:0 6px;" width="${btnWidth}"><a href="${escapeHtml(
        opts.acceptUrl!.trim()
      )}" style="display:block;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;background:#1C4854;color:#ffffff;">${escapeHtml(
        acceptLabel
      )}</a></td>`);
    }
    if (hasReject) {
      btns.push(`<td style="padding:0 6px;" width="${btnWidth}"><a href="${escapeHtml(
        opts.rejectUrl!.trim()
      )}" style="display:block;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;background:#ffffff;color:#1C4854;border:1px solid #1C4854;">${escapeHtml(
        rejectLabel
      )}</a></td>`);
    }
    ctaBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0;"><tr>${btns.join(
      ''
    )}</tr></table>`;
  }

  const deadlineNote = !isBlank(opts.deadlineText)
    ? `<div style="text-align:center;color:#7A7974;font-size:13px;margin-top:14px;">آخر موعد للرد: ${escapeHtml(
        opts.deadlineText!.trim()
      )}</div>`
    : '';

  const signoff = `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #EFECE5;color:#3B4A52;font-size:14px;line-height:1.8;">
          مع خالص التقدير،<br>
          <strong style="color:#1C4854;">فريق برنامج ابتكار المنافسة</strong>
        </div>`;

  const year = new Date().getFullYear();

  return `<!doctype html>
<html dir="${dir}" lang="${rtl ? 'ar' : 'en'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#ECEEF0;direction:${dir};color:#232529;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="620" style="max-width:620px;width:100%;margin:0 auto;">
    <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E9EC;">

      <!-- Header -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="background:#1C4854;background:linear-gradient(135deg,#1C4854 0%,#245C6B 100%);padding:40px 24px 28px;text-align:center;">
          ${logo}
          <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:20px;letter-spacing:-0.2px;">برنامج ابتكار المنافسة</div>
          <div style="color:#CFEDF8;font-size:13px;letter-spacing:0.6px;margin-top:4px;font-weight:500;">GAC Innovation Program</div>
        </td></tr>
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#3FBAC8;background:linear-gradient(90deg,#3FBAC8 0%,#E0A82E 50%,#3FBAC8 100%);">&nbsp;</td></tr>
      </table>

      <!-- Body -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding:32px 32px 28px;text-align:${rtl ? 'right' : 'left'};">
          ${greeting}
          <div style="font-size:20px;font-weight:700;color:#232529;line-height:1.5;margin-bottom:20px;">${subject}</div>
          <div style="font-size:15px;line-height:1.85;color:#3B4A52;margin-bottom:18px;">${htmlBody}</div>
          ${metaStrip}
          ${optionalBox}
          ${ctaBlock}
          ${deadlineNote}
          ${signoff}
        </td></tr>
      </table>

      <!-- Footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="background:#F7F5EF;padding:22px 24px;text-align:center;border-top:1px solid #EFE9DA;">
          <div style="font-size:16px;font-weight:700;color:#1C4854;letter-spacing:4px;margin-bottom:6px;">ابتكر<span style="color:#E0A82E;padding:0 4px;">·</span>نافس<span style="color:#E0A82E;padding:0 4px;">·</span>أثّر</div>
          <div style="font-size:12px;color:#7A7974;margin-top:4px;">الهيئة العامة للمنافسة — General Authority for Competition</div>
          <div style="font-size:11px;color:#9A9A96;margin-top:10px;">هذه رسالة تلقائية — يرجى عدم الرد عليها مباشرة. © ${year}</div>
        </td></tr>
      </table>

    </td></tr>
  </table>
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
