// src/lib/messaging/stub.ts
// Default provider — logs to stderr instead of hitting a real API. Keeps dev,
// preview and CI environments cost-free and lets us plug a real vendor later
// without changing any call sites.

import type {
  MessagingProvider,
  MessagingResult,
  NotificationMessageInput,
  OtpMessageInput,
} from './provider';

export const stubProvider: MessagingProvider = {
  id: 'stub',
  async sendOtp(input: OtpMessageInput): Promise<MessagingResult> {
    // eslint-disable-next-line no-console
    console.error(
      '[WA STUB] OTP →',
      input.phoneE164,
      `code=${input.code}`,
      `ttl=${input.ttlMinutes ?? '?'}m`,
      `locale=${input.locale ?? 'ar'}`
    );
    return { ok: true, providerId: 'stub' };
  },
  async sendNotification(input: NotificationMessageInput): Promise<MessagingResult> {
    const title = input.locale === 'en' ? input.titleEn : input.titleAr;
    const body = input.locale === 'en' ? input.bodyEn : input.bodyAr;
    // eslint-disable-next-line no-console
    console.error(
      '[WA STUB] NOTIFY →',
      input.phoneE164,
      `title="${title}"`,
      `body="${body}"`,
      input.link ? `link=${input.link}` : ''
    );
    return { ok: true, providerId: 'stub' };
  },
};
