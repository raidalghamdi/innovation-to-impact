// src/lib/messaging/meta-whatsapp.ts
// Meta Cloud API adapter (graph.facebook.com). Not wired to real credentials
// yet — reads META_WA_ACCESS_TOKEN + META_WA_PHONE_NUMBER_ID from env at call
// time. When either is missing, falls back to a warning-only response so a
// misconfigured production does not crash the whole flow.

import type {
  MessagingProvider,
  MessagingResult,
  NotificationMessageInput,
  OtpMessageInput,
} from './provider';

const GRAPH_VERSION = 'v20.0';

async function postToMeta(
  phoneNumberId: string,
  accessToken: string,
  payload: unknown
): Promise<MessagingResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, providerId: 'meta', error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, providerId: 'meta' };
  } catch (err) {
    return { ok: false, providerId: 'meta', error: (err as Error).message };
  }
}

function metaEnv(): { accessToken: string; phoneNumberId: string } | null {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

// Template names must be pre-approved in the Meta Business Manager. Defaults
// below match the templates we will create when the customer is onboarded.
const OTP_TEMPLATE = process.env.META_WA_OTP_TEMPLATE || 'otp_login';
const NOTIFY_TEMPLATE = process.env.META_WA_NOTIFY_TEMPLATE || 'i2i_notification';

export const metaProvider: MessagingProvider = {
  id: 'meta',
  async sendOtp(input: OtpMessageInput): Promise<MessagingResult> {
    const env = metaEnv();
    if (!env) {
      // eslint-disable-next-line no-console
      console.error('[WA META] missing credentials; falling back to log-only');
      // eslint-disable-next-line no-console
      console.error('[WA META fallback] OTP →', input.phoneE164, `code=${input.code}`);
      return { ok: false, providerId: 'meta', error: 'missing_credentials' };
    }
    const payload = {
      messaging_product: 'whatsapp',
      to: input.phoneE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: OTP_TEMPLATE,
        language: { code: input.locale === 'en' ? 'en' : 'ar' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: input.code }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: input.code }],
          },
        ],
      },
    };
    return postToMeta(env.phoneNumberId, env.accessToken, payload);
  },
  async sendNotification(input: NotificationMessageInput): Promise<MessagingResult> {
    const env = metaEnv();
    if (!env) {
      // eslint-disable-next-line no-console
      console.error('[WA META] missing credentials; falling back to log-only');
      return { ok: false, providerId: 'meta', error: 'missing_credentials' };
    }
    const locale = input.locale === 'en' ? 'en' : 'ar';
    const title = locale === 'en' ? input.titleEn : input.titleAr;
    const body = locale === 'en' ? input.bodyEn : input.bodyAr;
    const payload = {
      messaging_product: 'whatsapp',
      to: input.phoneE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: NOTIFY_TEMPLATE,
        language: { code: locale },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: title },
              { type: 'text', text: body },
            ],
          },
        ],
      },
    };
    return postToMeta(env.phoneNumberId, env.accessToken, payload);
  },
};
