// src/lib/messaging/provider.ts
// Provider-agnostic messaging interface. Each adapter (stub, meta, unifonic,
// twilio) implements this so the caller (otp.ts, notifications.ts) never
// hard-codes a vendor.

export type MessagingResult = { ok: boolean; providerId: string; error?: string };

export type OtpMessageInput = {
  phoneE164: string; // e.g. +9665XXXXXXXX
  code: string;
  locale?: 'ar' | 'en';
  ttlMinutes?: number;
};

export type NotificationMessageInput = {
  phoneE164: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  locale?: 'ar' | 'en';
  link?: string | null;
};

export interface MessagingProvider {
  readonly id: string; // 'stub' | 'meta' | 'unifonic' | 'twilio'
  sendOtp(input: OtpMessageInput): Promise<MessagingResult>;
  sendNotification(input: NotificationMessageInput): Promise<MessagingResult>;
}

// Validates and normalises a Saudi-friendly E.164 phone number.
// Returns the E.164 form (with leading +) or null if invalid.
export function normalizeE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Strip common separators.
  const digits = trimmed.replace(/[\s\-().]/g, '');
  // Already E.164?
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  // Local Saudi format: 05XXXXXXXX -> +9665XXXXXXXX
  if (/^0?5\d{8}$/.test(digits)) {
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    return `+966${local}`;
  }
  // Bare international without +: 9665XXXXXXXX
  if (/^966\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
