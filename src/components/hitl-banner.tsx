'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { Sparkles, X } from 'lucide-react';

// Human-in-the-loop reminder banner. Shown on routes that surface AI-assisted
// content (duplicate detection, executive summary, notifications translation)
// so reviewers know to verify before acting. Dismissible per browser session
// via localStorage — reappears in a new session/tab-less-storage but not on
// every navigation within the same session.
// Note: the innovator's own idea views (`/ideas`, `/ideas/[id]`) are
// intentionally excluded — they surface no AI-assisted content, so the banner
// was removed there. The /evaluator dashboard was ALSO excluded (Round 27)
// because the reminder was redundant on a page that's already all about
// human review; the banner still fires on committee/admin AI screens.
const AI_ASSISTED_PREFIXES = [
  '/admin/analytics',
  '/committee',
  '/admin/change-requests',
];

const DISMISS_KEY = 'i2i.hitlBanner.dismissed';

function isAiAssistedRoute(pathname: string): boolean {
  return AI_ASSISTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function HitlBanner() {
  const t = useTranslations('hitl');
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const shouldShow = mounted && !dismissed && isAiAssistedRoute(pathname ?? '');

  if (!shouldShow) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage unavailable (private mode / disabled) — dismissal just won't persist
    }
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-brand-teal/20 bg-brand-teal-light/40 px-4 py-2 text-sm text-brand-teal-dark sm:px-6 lg:px-8"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
        <span>{t('banner')}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
