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
import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { resolveRoleSync, type Role } from '@/lib/roles';
import { Menu, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>('submitter');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setUserId(user.id);
      // Client: no DB access here, use the sync resolver (metadata → email).
      setRole(resolveRoleSync(user));
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-teal focus:px-4 focus:py-2 focus:text-white"
      >
        {t('common.skipToContent')}
      </a>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t('common.closeMenu') : t('common.openMenu')}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <CoBrand className="h-12" locale={locale} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
          <Button asChild size="sm" variant="gold" className="hidden sm:inline-flex">
            <Link href="/ideas/new">
              <Plus className="h-4 w-4" />
              {t('nav.submitIdea')}
            </Link>
          </Button>
          <PointsBadge userId={userId} />
          <NotificationBell userId={userId} />
          <LanguageToggle />
          {userId && <SignOutButton />}
        </div>
      </header>

      <HitlBanner />

      <div className="flex flex-1">
        {/* Desktop sidebar */}
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
        <main id="main-content" className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
