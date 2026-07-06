'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { getRoleIcon } from '@/lib/role-icons';
import { ChevronDown, Check } from 'lucide-react';

export type RoleOption = { code: string; name_ar: string; name_en: string };

// src/components/role-switcher.tsx:1
// Phase 11.2 — visible only when the user holds 2+ roles. Shows the current
// active role with a dropdown of the others; selecting one updates the
// i2i_active_role cookie server-side then refreshes the dashboard.
export function RoleSwitcher({ roles, activeRole }: { roles: RoleOption[]; activeRole: string }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (roles.length < 2) return null;

  const current = roles.find((r) => r.code === activeRole) ?? roles[0];
  const CurrentIcon = getRoleIcon(current.code);

  async function switchTo(code: string) {
    if (code === activeRole) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/api/auth/set-active-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: code }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={switching}
        className="flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal-light/50 px-3 py-1.5 text-sm font-medium text-brand-teal transition hover:bg-brand-teal-light disabled:opacity-60"
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="max-w-[7rem] truncate">{isAr ? current.name_ar : current.name_en}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <ul className="py-1">
            {roles.map((role) => {
              const Icon = getRoleIcon(role.code);
              const isActive = role.code === activeRole;
              return (
                <li key={role.code}>
                  <button
                    type="button"
                    onClick={() => switchTo(role.code)}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-brand-teal-light/40"
                  >
                    <Icon className="h-4 w-4 text-brand-teal" />
                    <span className="flex-1 text-start">{isAr ? role.name_ar : role.name_en}</span>
                    {isActive && <Check className="h-4 w-4 text-brand-teal" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
