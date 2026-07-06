// src/lib/messaging/index.ts
// Public façade for OTP + notification delivery. Callers do NOT need to know
// which provider is active; they just call sendOtpMessage / sendNotificationMessage.
//
// Provider is selected in this order:
//   1. innovation.platform_settings.whatsapp_provider ('stub' | 'meta' | 'unifonic')
//   2. env MESSAGING_PROVIDER (same enum)
//   3. defaults to 'stub'
//
// Delivery is fully gated by innovation.platform_settings.whatsapp_enabled and
// whatsapp_channels.{otp,notifications}. When gates are off, the send is a
// no-op that resolves { ok:true, providerId:'disabled' } — callers should keep
// running (email + in-app path stays untouched).

import { getPlatformSetting } from '@/lib/db-roles';
import { metaProvider } from './meta-whatsapp';
import type {
  MessagingProvider,
  MessagingResult,
  NotificationMessageInput,
  OtpMessageInput,
} from './provider';
import { normalizeE164 } from './provider';
import { stubProvider } from './stub';
import { unifonicProvider } from './unifonic';

export { normalizeE164 } from './provider';
export type {
  MessagingResult,
  NotificationMessageInput,
  OtpMessageInput,
} from './provider';

type ProviderId = 'stub' | 'meta' | 'unifonic';

const REGISTRY: Record<ProviderId, MessagingProvider> = {
  stub: stubProvider,
  meta: metaProvider,
  unifonic: unifonicProvider,
};

async function pickProvider(): Promise<MessagingProvider> {
  const fromDb = await getPlatformSetting<string>('whatsapp_provider', '');
  const fromEnv = (process.env.MESSAGING_PROVIDER || '').trim();
  const chosen = (fromDb || fromEnv || 'stub').toLowerCase();
  if (chosen === 'meta' || chosen === 'unifonic' || chosen === 'stub') {
    return REGISTRY[chosen];
  }
  return stubProvider;
}

type ChannelGate = { otp: boolean; notifications: boolean };

async function loadGate(): Promise<{ enabled: boolean; channels: ChannelGate }> {
  const [enabled, channels] = await Promise.all([
    getPlatformSetting<boolean>('whatsapp_enabled', false),
    getPlatformSetting<ChannelGate>('whatsapp_channels', { otp: true, notifications: true }),
  ]);
  return {
    enabled: Boolean(enabled),
    channels: {
      otp: channels?.otp !== false,
      notifications: channels?.notifications !== false,
    },
  };
}

const disabled = (): MessagingResult => ({ ok: true, providerId: 'disabled' });

/**
 * Best-effort WhatsApp OTP send. Never throws; returns a result object so the
 * caller can log without impacting the login flow.
 */
export async function sendOtpMessage(input: OtpMessageInput): Promise<MessagingResult> {
  try {
    const gate = await loadGate();
    if (!gate.enabled || !gate.channels.otp) return disabled();
    const phone = normalizeE164(input.phoneE164);
    if (!phone) return { ok: false, providerId: 'skipped', error: 'invalid_phone' };
    const provider = await pickProvider();
    return provider.sendOtp({ ...input, phoneE164: phone });
  } catch (err) {
    return { ok: false, providerId: 'error', error: (err as Error).message };
  }
}

/**
 * Best-effort WhatsApp notification send. Silent no-op when disabled or when
 * the recipient has no phone on file.
 */
export async function sendNotificationMessage(input: NotificationMessageInput): Promise<MessagingResult> {
  try {
    const gate = await loadGate();
    if (!gate.enabled || !gate.channels.notifications) return disabled();
    const phone = normalizeE164(input.phoneE164);
    if (!phone) return { ok: false, providerId: 'skipped', error: 'invalid_phone' };
    const provider = await pickProvider();
    return provider.sendNotification({ ...input, phoneE164: phone });
  } catch (err) {
    return { ok: false, providerId: 'error', error: (err as Error).message };
  }
}
