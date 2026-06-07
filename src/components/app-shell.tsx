'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { SidebarNav } from '@/components/sidebar-nav';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Menu, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="text-brand-teal">
              <Logo className="h-8 w-8" />
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold text-brand-teal">
                {t('app.name')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('app.owner')}
              </span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="gold" className="hidden sm:inline-flex">
            <Link href="/ideas/new">
              <Plus className="h-4 w-4" />
              {t('nav.submitIdea')}
            </Link>
          </Button>
          <LanguageToggle />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-e border-border bg-card lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <SidebarNav />
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
              className={cn(
                'absolute top-0 h-full w-64 overflow-y-auto bg-card shadow-xl',
                'start-0'
              )}
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <span className="text-sm font-semibold text-brand-teal">
                  {t('app.name')}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <SidebarNav onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
