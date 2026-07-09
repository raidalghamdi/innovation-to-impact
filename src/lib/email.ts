import { Resend } from 'resend';

// Transactional email via Resend. Best-effort like the audit layer: if
// RESEND_API_KEY is missing we warn once and no-op so previews, builds and
// local runs never fail for lack of an email provider. Never throws.

const FROM = process.env.RESEND_FROM ?? 'i2i <onboarding@resend.dev>';

let warned = false;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warned) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn('[email] RESEND_API_KEY not set — transactional email disabled.');
    }
    return null;
  }
  return new Resend(key);
}

export type SendTransactionalInput = {
  to: string;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  locale?: string;
};

// Minimal bilingual, RTL-aware HTML shell. Arabic renders dir="rtl" end-to-end:
// the <html> and container carry `direction`, text is aligned to the start edge
// (right for AR), and the accent border sits on the start edge so padding mirrors
// correctly instead of always hugging the left.
function renderHtml(opts: { title: string; body: string; rtl: boolean }): string {
  const dir = opts.rtl ? 'rtl' : 'ltr';
  const align = opts.rtl ? 'right' : 'left';
  const startSide = opts.rtl ? 'right' : 'left';
  return `<!doctype html>
<html dir="${dir}" lang="${opts.rtl ? 'ar' : 'en'}">
  <body style="margin:0;background:#f4f6f8;padding:24px;direction:${dir};font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e9ee;direction:${dir};text-align:${align};">
      <div style="background:#01696F;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:bold;text-align:${align};">
        برنامج ابتكار المنافسة · ابتكر · نافس · أثّر
      </div>
      <div style="padding:20px;border-${startSide}:4px solid #01696F;color:#28251D;text-align:${align};">
        <h1 style="margin:0 0 12px;font-size:18px;">${opts.title}</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3b4a52;">${opts.body}</p>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendTransactional(input: SendTransactionalInput): Promise<void> {
  try {
    const resend = client();
    if (!resend) return;
    const rtl = input.locale === 'ar';
    const subject = rtl ? input.subject_ar : input.subject_en;
    const title = rtl ? input.subject_ar : input.subject_en;
    const body = rtl ? input.body_ar : input.body_en;
    await resend.emails.send({
      from: FROM,
      to: input.to,
      subject,
      html: renderHtml({ title, body, rtl }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed:', err);
  }
}

// One section (EN or AR) of a stacked bilingual email — reuses the same
// header/accent-border treatment as renderHtml but is meant to be concatenated
// with its counterpart in the other language rather than shipped alone.
function renderSection(opts: { title: string; bodyHtml: string; rtl: boolean }): string {
  const dir = opts.rtl ? 'rtl' : 'ltr';
  const align = opts.rtl ? 'right' : 'left';
  const startSide = opts.rtl ? 'right' : 'left';
  return `<div style="padding:20px;border-${startSide}:4px solid #01696F;color:#28251D;text-align:${align};direction:${dir};font-family:${opts.rtl ? "'Cairo','Segoe UI',Tahoma,Arial,sans-serif" : "'Segoe UI',Tahoma,Arial,Helvetica,sans-serif"};">
      <h2 style="margin:0 0 12px;font-size:16px;">${opts.title}</h2>
      <div style="margin:0;font-size:14px;line-height:1.7;color:#3b4a52;">${opts.bodyHtml}</div>
    </div>`;
}

export type SendBilingualEmailInput = {
  to: string | string[];
  subject: string;
  titleEn: string;
  bodyHtmlEn: string;
  titleAr: string;
  bodyHtmlAr: string;
};

/**
 * Send a single email containing both an English section (LTR) and an Arabic
 * section (RTL), stacked EN-then-AR, sharing the i2i header. Used for
 * recipient groups (e.g. all admins) that may include either-language
 * readers, so nobody misses content behind a locale toggle that doesn't
 * exist in email clients. Reuses the same RTL-hardening as renderHtml/
 * renderSection: each section carries its own `direction` + text-align so the
 * accent border and alignment mirror correctly per section regardless of the
 * outer envelope's dir.
 */
export async function sendBilingualEmail(input: SendBilingualEmailInput): Promise<void> {
  try {
    const resend = client();
    if (!resend) return;
    const to = Array.isArray(input.to) ? input.to : [input.to];
    if (to.length === 0) return;
    const html = `<!doctype html>
<html dir="ltr" lang="en">
  <body style="margin:0;background:#f4f6f8;padding:24px;font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e9ee;">
      <div style="background:#01696F;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:bold;">
        برنامج ابتكار المنافسة · ابتكر · نافس · أثّر
      </div>
      ${renderSection({ title: input.titleEn, bodyHtml: input.bodyHtmlEn, rtl: false })}
      <div style="border-top:1px solid #e5e9ee;"></div>
      ${renderSection({ title: input.titleAr, bodyHtml: input.bodyHtmlAr, rtl: true })}
    </div>
  </body>
</html>`;
    await resend.emails.send({
      from: FROM,
      to,
      subject: input.subject,
      html,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] bilingual send failed:', err);
  }
}
