'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronDown, User, Users, Star, Bell, Settings, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/[locale]/actions/auth';
import { useLocale } from 'next-intl';

// Compact right-side dropdown for authenticated non-admin roles (submitter /
// evaluator / judge) using the Landing-style top nav instead of the sidebar.
export function UserMenu({ displayName }: { displayName: string }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale();
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
    { href: '/my-ideas', key: 'myIdeas', icon: User },
    { href: '/team', key: 'team', icon: Users },
    { href: '/profile/level', key: 'level', icon: Star, labelFallback: 'مستواي' },
    { href: '/notifications', key: 'notifications', icon: Bell },
    { href: '/settings', key: 'settings', icon: Settings },
  ] as const;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-brand-teal-light/40"
      >
        <User className="h-4 w-4 text-brand-teal" />
        <span className="max-w-[8rem] truncate">{displayName}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <ul className="py-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href as any}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-brand-teal-light/40"
                  >
                    <Icon className="h-4 w-4 text-brand-teal" />
                    <span>{('labelFallback' in item && item.labelFallback) || t(item.key as any)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border">
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {tc('logout')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
