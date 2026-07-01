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

export function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
