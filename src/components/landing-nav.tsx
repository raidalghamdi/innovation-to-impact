'use client';

/**
 * Unified public Nav Bar — used on every "before login" page.
 *
 * Smart anchor links:
 *   - When the current path is the landing page (`/`, `/ar`, `/en`), links stay as
 *     pure `#anchor` so the browser performs a smooth in-page scroll.
 *   - On any other public page (e.g. `/ar/tracks/123`, `/ar/ip-terms`), links
 *     become `/ar/#anchor` so the user is navigated to the landing page and the
 *     target section is scrolled into view on arrival.
 *
 * Responsive: desktop (≥lg) shows the horizontal nav; below lg a hamburger opens
 * a full-height Drawer from the inline-end edge (right in RTL) with the same
 * links, language toggle and login CTA.
 *
 * This is intentionally separate from `app-shell.tsx` (the authenticated shell
 * with sidebar + role-based CTAs). Do NOT use this component inside the app.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CoBrand } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { HeaderSearch } from '@/components/header-search';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const ANCHOR_NAV = [
  { anchor: 'about', key: 'navAbout' },
  { anchor: 'tracks', key: 'navTracks' },
  { anchor: 'timeline', key: 'navTimeline' },
  { anchor: 'criteria', key: 'navCriteria' },
  { anchor: 'prizes', key: 'navPrizes' },
  { anchor: 'faq', key: 'navFaq' },
] as const;

export function LandingNav({ locale }: { locale: string }) {
  const t = useTranslations();
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  // Strip trailing slash for comparison; next-intl paths look like /ar or /en.
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const isLandingRoot =
    normalized === '/' ||
    normalized === `/${locale}` ||
    normalized === '/ar' ||
    normalized === '/en';

  const buildHref = (anchor: string) =>
    isLandingRoot ? `#${anchor}` : `/${locale}/#${anchor}`;

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll-lock + Esc-to-close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 pt-safe backdrop-blur sm:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <CoBrand className="h-12" locale={locale} />
      </Link>

      {/* Desktop nav (≥lg) */}
      <nav
        className="hidden items-center gap-1 lg:flex"
        aria-label={t('footer.quickLinks')}
      >
        {ANCHOR_NAV.map((n) => (
          <a
            key={n.anchor}
            href={buildHref(n.anchor)}
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal"
          >
            {t(`landing.${n.key}`)}
          </a>
        ))}
      </nav>

      {/* Desktop actions (≥lg) */}
      <div className="hidden items-center gap-2 lg:flex">
        <div className="hidden md:block">
          <HeaderSearch />
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t('nav.login')}</Link>
        </Button>
        <LanguageToggle />
      </div>

      {/* Mobile hamburger (<lg) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('landing.openMenu')}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition hover:bg-muted lg:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer (from inline-end) */}
      <aside
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('landing.menuTitle')}
        className={`fixed inset-y-0 end-0 z-50 flex h-screen w-[85%] max-w-sm flex-col bg-card shadow-2xl transition-transform duration-300 ease-out pt-safe pb-safe lg:hidden ${
          open ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'
        }`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-border px-4">
          <CoBrand className="h-10" locale={locale} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('landing.closeMenu')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition hover:bg-muted"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label={t('footer.quickLinks')}
        >
          <ul className="space-y-1">
            {ANCHOR_NAV.map((n) => (
              <li key={n.anchor}>
                <a
                  href={buildHref(n.anchor)}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center rounded-lg px-4 text-base font-medium text-foreground transition hover:bg-brand-teal-light hover:text-brand-teal"
                >
                  {t(`landing.${n.key}`)}
                </a>
              </li>
            ))}
          </ul>

          <div className="my-4 border-t border-border" />

          <div className="px-1">
            <LanguageToggle />
          </div>
        </nav>

        <div className="shrink-0 border-t border-border p-4">
          <Button asChild variant="gold" size="lg" className="w-full">
            <Link href="/login" onClick={() => setOpen(false)}>
              {t('nav.login')}
            </Link>
          </Button>
        </div>
      </aside>
    </header>
  );
}
