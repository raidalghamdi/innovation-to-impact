'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronDown, User as UserIcon, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/[locale]/actions/auth';
import { getMenuForRole } from '@/lib/menu-for-role';

// src/components/role-user-menu.tsx:1
// Phase 12.3 — dynamic avatar dropdown for the new role-based dashboards.
// Items come from getMenuForRole(activeRole); Logout is always appended last.
export function RoleUserMenu({ displayName, activeRole }: { displayName: string; activeRole: string }) {
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

  const items = getMenuForRole(activeRole);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-brand-teal-light/40"
      >
        <UserIcon className="h-4 w-4 text-brand-teal" />
        <span className="max-w-[8rem] truncate">{displayName}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
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
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
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
                {isAr ? 'تسجيل الخروج' : 'Logout'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
