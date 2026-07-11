import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Always render numbers with Latin (Western Arabic) digits — 1,230,000 not ١،٢٣٠،٠٠٠.
// User preference: numbers stay in English digits across the site regardless of UI locale.
export function formatSAR(value: number, _locale?: string) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

// Generic number formatter with Latin digits and grouping. Use everywhere
// numbers appear so they stay consistent between AR/EN.
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, ...opts }).format(value);
}

// Dates are always Gregorian (ميلادي) with Latin digits, even in Arabic —
// never Hijri / Umm al-Qura. `ar-SA-u-ca-gregory-nu-latn` forces this.
// Round 29 point 6: time is 12-hour with AM/PM across ALL four dashboards
// (innovator / evaluator / supervisor / admin). Arabic renders as "1:17 م" /
// "11:56 ص"; English as "1:17 PM" / "11:56 AM". No leading zero on the hour.
export function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

// Alias with an explicit name so call sites that specifically want the
// "date + 12h time" combo can be self-documenting. Identical output to
// formatDate — both go through the same Intl formatter above.
export function formatDateTime(value: string | null | undefined, locale: string) {
  return formatDate(value, locale);
}

// Date-only formatter for headers/labels where time would be noise.
// Use sparingly — the platform default is formatDate (with time).
export function formatDateOnly(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
