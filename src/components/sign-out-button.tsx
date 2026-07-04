'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/[locale]/actions/auth';

/**
 * Sign-out button. Wraps the signOutAction server action in a form so the
 * button remains keyboard-accessible and works without JS.
 *
 * Variants:
 *   - "icon" (default in header) — compact icon-only button
 *   - "text"                     — full "Sign out" text button (settings page)
 */
export function SignOutButton({
  variant = 'icon',
}: {
  variant?: 'icon' | 'text';
}) {
  const t = useTranslations('common');
  const locale = useLocale();
  const label = t('logout');

  return (
    <form action={signOutAction}>
      <input type="hidden" name="locale" value={locale} />
      {variant === 'icon' ? (
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button type="submit" variant="outline" className="gap-2">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      )}
    </form>
  );
}
