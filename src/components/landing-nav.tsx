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
import { Button } from '@/components/ui/button';
import { ROLE_HOME } from '@/lib/roles';
import type { Role } from '@/lib/roles';
import { Menu, X, LayoutDashboard } from 'lucide-react';

export type LandingNavUser = {
  displayName: string;
  role: Role;
  // Round 30: raw DB role codes (from v_user_roles). Supervisor is coerced to
  // 'admin' in the canonical Role enum — the raw codes let LandingNav render
  // supervisor-specific behaviour (e.g. hide the "لوحتي" quick-jump per the
  // Round 30 spec) without changing broader role semantics.
  roleCodes?: string[];
} | null;

const ANCHOR_NAV = [
  { anchor: 'about', key: 'navAbout' },
  { anchor: 'tracks', key: 'navTracks' },
  { anchor: 'timeline', key: 'navTimeline' },
  { anchor: 'criteria', key: 'navCriteria' },
  { anchor: 'prizes', key: 'navPrizes' },
  { anchor: 'faq', key: 'navFaq' },
] as const;

export function LandingNav({
  locale,
  hideLoginCta = false,
  hideAnchors = false,
  user = null,
}: {
  locale: string;
  hideLoginCta?: boolean;
  // Suppress the marketing anchor links (about/tracks/…). Used when LandingNav
  // serves as the header for an authenticated app surface (e.g. /dashboard).
  hideAnchors?: boolean;
  user?: LandingNavUser;
}) {
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

  // Round 30 §5b + Round 32: pick the correct dashboard target for the user.
  //   - Supervisor's canonical Role is coerced to 'admin' (see src/lib/user.ts),
  //     so ROLE_HOME[user.role] would send them to /admin. Fall back to
  //     '/supervisor' when the raw role codes include supervisor and no
  //     stronger 'admin' code.
  //   - Evaluator's canonical Role is 'evaluator' and ROLE_HOME.evaluator is
  //     already '/evaluator', so the default works. We also check the raw
  //     codes as a defensive belt-and-braces so the Nav's "لوحة أعمالي"
  //     always mirrors the user dropdown's routing regardless of how the
  //     canonical Role was resolved upstream.
  const dashboardHref: string = (() => {
    if (!user) return '/login';
    const codes = user.roleCodes ?? [];
    if (codes.includes('supervisor') && !codes.includes('admin')) return '/supervisor';
    if (codes.includes('evaluator') && !codes.includes('admin')) return '/evaluator';
    return ROLE_HOME[user.role];
  })();

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
    <>
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 pt-safe backdrop-blur sm:h-24 sm:gap-3 sm:px-6 xl:h-28 xl:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        {/* CoBrand renders TWO horizontal marks side-by-side (~2.2:1 combined
           aspect ratio) plus a divider. Total width ≈ height × 5.5, so a 64px
           tall logo eats ~380px — leaving no room for 6 anchor links + a
           search box + auth actions on a 1280px viewport. We cap it at h-14
           (≈50px, ~290px wide) until 2xl (1536px), where the extra breathing
           room finally allows h-16. */}
        <CoBrand className="h-12 sm:h-14 xl:h-16" locale={locale} />
      </Link>

      {/* Desktop nav (≥lg) */}
      {!hideAnchors && (
        <nav
          className="hidden items-center gap-0.5 lg:flex xl:gap-1"
          aria-label={t('footer.quickLinks')}
        >
          {ANCHOR_NAV.map((n) => (
            <a
              key={n.anchor}
              href={buildHref(n.anchor)}
              className="rounded-md px-2 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal xl:px-3"
            >
              {t(`landing.${n.key}`)}
            </a>
          ))}
        </nav>
      )}

      {/* Desktop actions (≥lg). This is the PUBLIC marketing nav — it must not
          leak internal-app chrome (platform search, user/role menu) onto the
          landing page. Authenticated visitors get a single "My dashboard" link
          back into the app; the full account menu lives inside AppShell. */}
      <div className="hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
        {!hideLoginCta && (
          user ? (
            // Round 32: restore "لوحة أعمالي" in the Nav Bar for EVERY signed-in
            // role. The Round 30 hide-for-supervisor/evaluator rule was too
            // aggressive — the intent was to remove the Hero CTA only, not the
            // Nav CTA. The Hero CTA (in src/app/[locale]/page.tsx) still
            // remains hidden for supervisor/evaluator, keeping the Hero clean
            // while the Nav gives every role a persistent way to reach their
            // own workboard. Routing uses dashboardHref above, which mirrors
            // the RoleUserMenu dropdown (Supervisor → /supervisor, Evaluator
            // → /evaluator, Innovator → /dashboard, Admin → /admin).
            <Button asChild variant="gold" size="sm">
              <Link href={dashboardHref}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="ms-2">{locale === 'ar' ? 'لوحة أعمالي' : 'My workboard'}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t('nav.login')}</Link>
            </Button>
          )
        )}
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
    </header>

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
          <CoBrand className="h-12 sm:h-14" locale={locale} />
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
          {!hideAnchors && (
            <>
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
            </>
          )}

          <div className="px-1">
            <LanguageToggle />
          </div>
        </nav>

        {!hideLoginCta && (
          <div className="shrink-0 space-y-2 border-t border-border p-4">
            {user ? (
              // Round 32: mobile drawer mirrors the desktop rule — the
              // "لوحة أعمالي" button is available to every signed-in role,
              // with per-role routing driven by dashboardHref.
              <>
                <div className="mb-1 text-center text-xs text-muted-foreground">
                  {locale === 'ar' ? 'مرحباً، ' : 'Welcome, '}
                  <span className="font-semibold text-foreground">{user.displayName}</span>
                </div>
                <Button asChild variant="gold" size="lg" className="w-full">
                  <Link href={dashboardHref} onClick={() => setOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="ms-2">{locale === 'ar' ? 'لوحة أعمالي' : 'My workboard'}</span>
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="gold" size="lg" className="w-full">
                <Link href="/login" onClick={() => setOpen(false)}>
                  {t('nav.login')}
                </Link>
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
