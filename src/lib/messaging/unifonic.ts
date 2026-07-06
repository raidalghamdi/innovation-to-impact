// src/lib/messaging/unifonic.ts
// Unifonic WhatsApp adapter. Reads UNIFONIC_APP_SID + UNIFONIC_API_KEY. When
// either is missing, returns a soft failure (never throws) so the caller stays
// resilient.

import type {
  MessagingProvider,
  MessagingResult,
  NotificationMessageInput,
  OtpMessageInput,
} from './provider';

function unifonicEnv(): { appSid: string; apiKey: string; senderId: string } | null {
  const appSid = process.env.UNIFONIC_APP_SID;
  const apiKey = process.env.UNIFONIC_API_KEY;
  const senderId = process.env.UNIFONIC_SENDER_ID || 'i2i';
  if (!appSid || !apiKey) return null;
  return { appSid, apiKey, senderId };
}

async function postToUnifonic(body: URLSearchParams): Promise<MessagingResult> {
  try {
    const res = await fetch('https://api.unifonic.com/rest/Messages/Send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, providerId: 'unifonic', error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, providerId: 'unifonic' };
  } catch (err) {
    return { ok: false, providerId: 'unifonic', error: (err as Error).message };
  }
}

export const unifonicProvider: MessagingProvider = {
  id: 'unifonic',
  async sendOtp(input: OtpMessageInput): Promise<MessagingResult> {
    const env = unifonicEnv();
    if (!env) {
      // eslint-disable-next-line no-console
      console.error('[WA UNIFONIC] missing credentials; falling back to log-only');
      // eslint-disable-next-line no-console
      console.error('[WA UNIFONIC fallback] OTP →', input.phoneE164, `code=${input.code}`);
      return { ok: false, providerId: 'unifonic', error: 'missing_credentials' };
    }
    const text =
      input.locale === 'en'
        ? `Your i2i verification code is ${input.code}. Valid ${input.ttlMinutes ?? 10} minutes.`
        : `رمز التحقق لمنصة i2i هو ${input.code}. صالح لمدة ${input.ttlMinutes ?? 10} دقائق.`;
    const params = new URLSearchParams({
      AppSid: env.appSid,
      Recipient: input.phoneE164.replace(/^\+/, ''),
      Body: text,
      SenderID: env.senderId,
    });
    return postToUnifonic(params);
  },
  async sendNotification(input: NotificationMessageInput): Promise<MessagingResult> {
    const env = unifonicEnv();
    if (!env) return { ok: false, providerId: 'unifonic', error: 'missing_credentials' };
    const locale = input.locale === 'en' ? 'en' : 'ar';
    const title = locale === 'en' ? input.titleEn : input.titleAr;
    const body = locale === 'en' ? input.bodyEn : input.bodyAr;
    const link = input.link ? `\n${input.link}` : '';
    const params = new URLSearchParams({
      AppSid: env.appSid,
      Recipient: input.phoneE164.replace(/^\+/, ''),
      Body: `${title}\n${body}${link}`,
      SenderID: env.senderId,
    });
    return postToUnifonic(params);
  },
};
