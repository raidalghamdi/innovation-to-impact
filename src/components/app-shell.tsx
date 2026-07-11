'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { SidebarNav } from '@/components/sidebar-nav';
import { LanguageToggle } from '@/components/language-toggle';
import { CoBrand } from '@/components/logo';
import { NotificationBell } from '@/components/notification-bell';
import { HitlBanner } from '@/components/hitl-banner';
import { PointsBadge } from '@/components/points-badge';
import { GlobalSearch } from '@/components/global-search';
import { HeaderSearch } from '@/components/header-search';
import { RoleUserMenu } from '@/components/role-user-menu';
import { SiteFooter } from '@/components/site-footer';
import { AdminBackNav } from '@/components/admin-back-nav';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { resolveRoleSync, type Role } from '@/lib/roles';
import { Menu, X, Plus, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Labels for the admin BackNav — kept here (not on the server layout) so the
// client BackNav can render on Vercel where request-path headers are unreliable.
const ADMIN_SECTION_LABELS: Record<string, { ar: string; en: string }> = {
  users: { ar: 'المستخدمون', en: 'Users' },
  roles: { ar: 'كتالوج الأدوار', en: 'Roles Catalog' },
  employees: { ar: 'استيراد الموظفين', en: 'Employees Import' },
  import: { ar: 'استيراد', en: 'Import' },
  settings: { ar: 'إعدادات المنصة', en: 'Platform Settings' },
  audit: { ar: 'سجلات التدقيق', en: 'Audit Logs' },
  analytics: { ar: 'التحليلات', en: 'Analytics' },
  backup: { ar: 'النسخ الاحتياطي', en: 'Backup' },
  escalations: { ar: 'التصعيدات', en: 'Escalations' },
  'change-requests': { ar: 'طلبات التعديل', en: 'Change Requests' },
  assignments: { ar: 'التعيينات', en: 'Assignments' },
  cms: { ar: 'محرر المحتوى', en: 'Content Editor' },
  phases: { ar: 'جدول المراحل', en: 'Phase Schedule' },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const isAdminSubPage = /^\/(ar|en)?\/admin\/[^/]+/.test(pathname);

  // Authenticated app routes must NOT show the public marketing anchor nav
  // (عن البرنامج · المسارات · …). These are RBAC-gated app surfaces, not the
  // public landing page. Strip the locale prefix, then match by route prefix.
  const APP_ROUTE_PREFIXES = [
    '/admin',
    '/dashboard',
    '/my-ideas',
    '/ideas',
    '/evaluator',
    '/supervisor',
    '/committee',
    '/notifications',
  ];
  const pathNoLocale = pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
  const showAnchorNav = !APP_ROUTE_PREFIXES.some(
    (p) => pathNoLocale === p || pathNoLocale.startsWith(`${p}/`)
  );
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>('submitter');
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setUserId(user.id);
      // Prefer the i2i_active_role cookie (canonical role source, set by
      // login-verify + role-switcher after DB lookup). Fall back to the sync
      // resolver only when the cookie is missing (first paint, edge cases).
      let resolvedRole: Role = resolveRoleSync(user);
      if (typeof document !== 'undefined') {
        const cookieRole = document.cookie
          .split('; ')
          .find((c) => c.startsWith('i2i_active_role='))
          ?.split('=')[1];
        // The DB uses aliases (innovator/committee/supervisor). Map them back
        // to canonical Role enum values before storing.
        if (cookieRole) {
          const key = decodeURIComponent(cookieRole).toLowerCase();
          if (key === 'admin') resolvedRole = 'admin';
          else if (key === 'judge' || key === 'committee') resolvedRole = 'judge';
          else if (key === 'supervisor') resolvedRole = 'supervisor';
          else if (key === 'evaluator') resolvedRole = 'evaluator';
          else if (key === 'submitter' || key === 'innovator') resolvedRole = 'submitter';
        }
      }
      setRole(resolvedRole);
      setDisplayName(
        (user.user_metadata?.full_name as string) ??
          (user.email ? user.email.split('@')[0] : '') ??
          ''
      );
    });
  }, []);

  const isAdmin = role === 'admin';

  // Landing-page anchors kept reachable from every authenticated sub-page,
  // matching <LandingNav /> so users get the same primary navigation regardless
  // of which shell is currently rendering.
  const ANCHOR_NAV = [
    { anchor: 'about', key: 'navAbout' },
    { anchor: 'tracks', key: 'navTracks' },
    { anchor: 'timeline', key: 'navTimeline' },
    { anchor: 'criteria', key: 'navCriteria' },
    { anchor: 'prizes', key: 'navPrizes' },
    { anchor: 'faq', key: 'navFaq' },
  ] as const;
  const anchorHref = (anchor: string) => `/${locale}/#${anchor}`;

  // Non-admin roles: unified single-row Nav Bar that matches LandingNav layout
  // exactly (logo → anchor links → actions). This keeps the header identical
  // pre- and post-login so users don't perceive the top bar jumping between pages.
  //
  // UX note (batch 07/26): eliminated the double-row header. User actions
  // (search, submit-idea, points, bell, language, avatar) all live in the same
  // row as the anchor nav. `overflow-visible` is critical — the avatar dropdown
  // and any other absolute-positioned popovers must render outside the header.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-teal focus:px-4 focus:py-2 focus:text-white"
        >
          {t('common.skipToContent')}
        </a>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 pt-safe backdrop-blur sm:h-24 sm:gap-3 sm:px-6 xl:h-28 xl:px-8">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2.5 overflow-hidden" aria-label={t('nav.home')}>
            {/* Matches LandingNav sizing exactly (see logo.tsx sizing notes). */}
            <CoBrand className="h-8 sm:h-10 xl:h-12" locale={locale} />
          </Link>

          {/* Round 30: persistent Home link back to the public landing page,
              pinned to the right of the logo (RTL: first element after the
              logo). Visible on every viewport so all roles can jump home from
              anywhere — label collapses to icon-only under lg. */}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal"
            aria-label={t('nav.homePage')}
          >
            <Home className="h-4 w-4" />
            <span className="hidden lg:inline">{t('nav.homePage')}</span>
          </Link>

          {/* Desktop anchor nav (≥xl) — same links as LandingNav. Hidden on
              authenticated app routes (dashboard, my-ideas, ideas, …). */}
          {showAnchorNav && (
            <nav
              className="hidden items-center gap-0.5 xl:flex 2xl:gap-1"
              aria-label="Program sections"
            >
              {ANCHOR_NAV.map(({ anchor, key }) => (
                <a
                  key={anchor}
                  href={anchorHref(anchor)}
                  className="rounded-md px-2 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal 2xl:px-3"
                >
                  {t(`landing.${key}`)}
                </a>
              ))}
            </nav>
          )}

          {/* Actions. Search hidden until 2xl to keep parity with LandingNav
              and avoid the same overflow issue that clipped the language button. */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 xl:gap-2">
            <div className="hidden 2xl:block">
              <HeaderSearch />
            </div>
            {/* Role-scoped primary action:
                 - evaluator          → no header CTA (Round 28: single 'Start
                                         evaluation' now lives in the Hero on
                                         /evaluator; header duplicate removed)
                 - judge              → "Start judging" (opens committee)
                 - supervisor         → no primary CTA (their job is reviewing
                                         the submitted-ideas queue, which is
                                         already the page they land on;
                                         "Submit idea" would be misleading)
                 - everyone else      → "Submit idea" */}
            {role === 'supervisor' || role === 'evaluator' ? null : role === 'judge' ? (
              <Button asChild size="sm" variant="gold" className="hidden md:inline-flex">
                <Link href="/committee">
                  <Plus className="h-4 w-4" />
                  <span className="ms-1 hidden xl:inline">{t('nav.startJudging')}</span>
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="gold" className="hidden md:inline-flex">
                <Link href="/ideas/new">
                  <Plus className="h-4 w-4" />
                  <span className="ms-1 hidden xl:inline">{t('nav.submitIdea')}</span>
                </Link>
              </Button>
            )}
            <PointsBadge userId={userId} role={role} />
            <NotificationBell userId={userId} role={role} />
            <LanguageToggle />
            {userId && <RoleUserMenu displayName={displayName || t('common.logout')} activeRole={role} />}
          </div>
        </header>

        <HitlBanner />

        <main id="main-content" className="w-full flex-1 overflow-x-hidden">
          <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>

        <SiteFooter locale={locale} />
      </div>
    );
  }

  // ── Admin role: full sidebar shell ───────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-teal focus:px-4 focus:py-2 focus:text-white"
      >
        {t('common.skipToContent')}
      </a>
      {/* Top bar */}
      <header className="sticky top-0 z-30 w-full border-b border-border bg-card">
        <div className="flex h-20 items-center justify-between gap-2 px-3 sm:h-28 sm:px-4">
          <div className="flex min-w-0 shrink items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? t('common.closeMenu') : t('common.openMenu')}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </Button>
            {/* Logo links to the public homepage so admins can jump back to the
                landing page from anywhere in the console. */}
            <Link href="/" className="flex min-w-0 shrink items-center gap-2.5 overflow-hidden" aria-label={t('nav.home')}>
              <CoBrand className="h-7 sm:h-10 md:h-12" locale={locale} />
            </Link>
            {/* Round 30 / Round 32: explicit Home link pinned next to the
                admin logo. The parent div already groups [Logo + Home] as a
                single flex cluster (see the sibling flex container above),
                so Home hugs the logo on the inline-start edge across all
                viewports. */}
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal"
              aria-label={t('nav.homePage')}
            >
              <Home className="h-4 w-4" />
              <span className="hidden lg:inline">{t('nav.homePage')}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
            {/* Admin shell: no "Submit Idea" CTA — admins manage the pipeline,
                they don't submit ideas from their own console. */}
            <PointsBadge userId={userId} role={role} />
            <NotificationBell userId={userId} role={role} />
            <LanguageToggle />
            {userId && (
              <RoleUserMenu
                displayName={displayName || t('common.logout')}
                activeRole={role}
              />
            )}
          </div>
        </div>
        {/* Anchor row — public landing sections. Hidden on /admin/* so the
            admin console renders inside its own shell only (no marketing nav). */}
        {showAnchorNav && (
          <nav
            aria-label="Program sections"
            className="scrollbar-none flex items-center gap-4 overflow-x-auto border-t border-border/60 bg-card/60 px-4 py-2 text-sm sm:justify-center sm:gap-6 sm:px-8"
          >
            {ANCHOR_NAV.map(({ anchor, key }) => (
              <a
                key={anchor}
                href={anchorHref(anchor)}
                className="shrink-0 whitespace-nowrap font-medium text-muted-foreground transition hover:text-brand-teal"
              >
                {t(`landing.${key}`)}
              </a>
            ))}
          </nav>
        )}
      </header>

      <HitlBanner />

      <div className="flex flex-1">
        {/* Desktop sidebar — admin only */}
        <aside className="hidden w-64 shrink-0 border-e border-border bg-card lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <SidebarNav role={role} />
          </div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <aside
              id="mobile-nav"
              aria-label={t('common.openMenu')}
              className={cn(
                'absolute top-0 h-full w-64 overflow-y-auto bg-card shadow-xl',
                'start-0'
              )}
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold text-brand-teal">
                  {t('app.name')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label={t('common.closeMenu')}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <SidebarNav role={role} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main id="main-content" className="w-full min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
            {isAdminSubPage && (
              <AdminBackNav locale={locale} sectionLabels={ADMIN_SECTION_LABELS} />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
