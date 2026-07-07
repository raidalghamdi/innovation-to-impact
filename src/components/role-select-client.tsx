'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { getRoleIcon } from '@/lib/role-icons';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { homeForRoleCode } from '@/lib/roles';

type RoleOption = { code: string; name_ar: string; name_en: string };

// src/components/role-select-client.tsx:1
export function RoleSelectClient({ locale, roles }: { locale: string; roles: RoleOption[] }) {
  const router = useRouter();
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const [pending, setPending] = useState<string | null>(null);

  async function selectRole(code: string) {
    setPending(code);
    try {
      const res = await fetch('/api/auth/set-active-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: code }),
      });
      if (res.ok) {
        router.push(homeForRoleCode(code) as any);
        router.refresh();
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {roles.map((role) => {
        const Icon = getRoleIcon(role.code);
        const busy = pending === role.code;
        return (
          <button
            key={role.code}
            type="button"
            onClick={() => selectRole(role.code)}
            disabled={pending !== null}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-start transition hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-lg disabled:opacity-60"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
            </span>
            <span className="flex-1">
              <span className="block text-base font-semibold text-foreground">
                {isAr ? role.name_ar : role.name_en}
              </span>
            </span>
            <Arrow className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-brand-teal" />
          </button>
        );
      })}
    </div>
  );
}
