'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronDown, User, Users, Star, Bell, Settings, LogOut, LayoutDashboard, Lightbulb, PlusCircle } from 'lucide-react';
import { signOutAction } from '@/app/[locale]/actions/auth';
import { useLocale } from 'next-intl';

// Compact right-side dropdown for authenticated non-admin roles (submitter /
// evaluator / judge) using the Landing-style top nav instead of the sidebar.
//
// UX note (batch 07/26): unified across every dashboard page — user sees the
// same items whether they're on the overview or a sub-page. "Profile" was
// removed to eliminate the duplicate with "Settings".
export function UserMenu({ displayName }: { displayName: string }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
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
    { href: '/dashboard', icon: LayoutDashboard, ar: 'لوحة أعمالي', en: 'My Dashboard' },
    { href: '/my-ideas', icon: Lightbulb, ar: 'أفكاري', en: 'My Ideas' },
    { href: '/ideas/new', icon: PlusCircle, ar: 'قدّم فكرة', en: 'Submit Idea' },
    { href: '/team', icon: Users, ar: 'فريقي', en: 'My Team' },
    { href: '/profile/level', icon: Star, ar: 'مستواي', en: 'My Level' },
    { href: '/notifications', icon: Bell, ar: 'الإشعارات', en: 'Notifications' },
    { href: '/settings', icon: Settings, ar: 'الإعدادات', en: 'Settings' },
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
                    <span>{isAr ? item.ar : item.en}</span>
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
