'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { Bell, ChevronDown, LayoutDashboard, ListChecks, Trophy, Settings, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/[locale]/actions/auth';

type Props = {
  locale: string;
  userName: string;
  unread: number;
  children: ReactNode;
};

/**
 * B1 — Evaluator chrome: sticky ink topbar + surface tabbar. Active tab is
 * derived from the current pathname (locale-stripped by next-intl routing).
 */
export function EvaluatorChrome({ locale, userName, unread, children }: Props) {
  const t = useTranslations('evaluator');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const hasUnread = unread > 0;

  // Normalize: treat exact /evaluator and /evaluator/ideas as the dashboard tab
  // vs the queue CTA. Sub-routes match by prefix.
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const tabs = [
    { href: '/evaluator', label: t('navDashboard'), exact: true },
    { href: '/evaluator/my-evaluations', label: t('navEvaluations') },
    { href: '/evaluator/notifications', label: t('navNotifications'), dot: hasUnread },
  ];

  return (
    <>
      {/* Topbar */}
      <header className="ev-topbar">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/evaluator" className="flex items-center gap-3">
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-sm font-extrabold text-white"
              style={{ background: 'var(--gold)' }}
            >
              اب
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{t('brandTitle')}</span>
              <span className="block text-[11px] text-white/60">{t('brandSub')}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/evaluator/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
              aria-label={t('navNotifications')}
            >
              <Bell className="h-[18px] w-[18px]" />
              {hasUnread && (
                <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--rust)]" />
              )}
            </Link>
            <AccountMenu locale={locale} userName={userName} t={t} logoutLabel={tc('logout')} />
          </div>
        </div>
      </header>

      {/* Tabbar */}
      <nav className="ev-tabbar">
        <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href as any}
              className="ev-tab"
              data-active={isActive(tab.href, tab.exact)}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--rust)]" />}
              </span>
            </Link>
          ))}
          <Link href="/evaluator/ideas" className="ev-btn-gold ms-auto my-2 shrink-0 text-sm">
            {t('startEvaluating')}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}

function AccountMenu({
  locale,
  userName,
  t,
  logoutLabel,
}: {
  locale: string;
  userName: string;
  t: ReturnType<typeof useTranslations>;
  logoutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const items = [
    { href: '/evaluator', label: t('navDashboard'), icon: LayoutDashboard },
    { href: '/evaluator/my-evaluations', label: t('navEvaluations'), icon: ListChecks },
    { href: '/evaluator/level', label: t('navLevel'), icon: Trophy },
    { href: '/evaluator/notifications', label: t('navNotifications'), icon: Bell },
    { href: '/evaluator/settings', label: t('navSettings'), icon: Settings },
  ];
  const initial = userName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pe-2 ps-1 text-white/90 hover:bg-white/10"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#2f6b4e,#46597a)' }}
        >
          {initial}
        </span>
        <span className="ev-hide-sm max-w-[140px] truncate text-sm">{userName}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 text-[var(--ink)] shadow-[var(--shadow-pop)]"
          role="menu"
        >
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href as any}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--paper)]"
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 text-[var(--ink-faint)]" />
                {it.label}
              </Link>
            );
          })}
          <div className="my-1 border-t border-[var(--line)]" />
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-[var(--rust)] hover:bg-[var(--rust-soft)]"
            >
              <LogOut className="h-4 w-4" />
              {logoutLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
