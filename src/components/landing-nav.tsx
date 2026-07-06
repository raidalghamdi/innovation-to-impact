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
 * This is intentionally separate from `app-shell.tsx` (the authenticated shell
 * with sidebar + role-based CTAs). Do NOT use this component inside the app.
 */

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CoBrand } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { HeaderSearch } from '@/components/header-search';
import { Button } from '@/components/ui/button';

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

  // Strip trailing slash for comparison; next-intl paths look like /ar or /en.
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const isLandingRoot =
    normalized === '/' ||
    normalized === `/${locale}` ||
    normalized === '/ar' ||
    normalized === '/en';

  const buildHref = (anchor: string) =>
    isLandingRoot ? `#${anchor}` : `/${locale}/#${anchor}`;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <CoBrand className="h-12" locale={locale} />
      </Link>
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
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden md:block">
          <HeaderSearch />
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t('nav.login')}</Link>
        </Button>
        <LanguageToggle />
      </div>
    </header>
  );
}
