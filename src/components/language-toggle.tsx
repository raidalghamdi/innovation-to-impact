'use client';

import { usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next = locale === 'ar' ? 'en' : 'ar';

  function switchLocale() {
    // Persist preference to user profile when signed in (best-effort).
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase
            .from('user_profiles')
            .update({ language_preference: next })
            .eq('id', data.user.id);
        }
      });
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={switchLocale}
      disabled={isPending}
      className="gap-1.5"
      aria-label={locale === 'ar' ? 'تغيير اللغة إلى الإنجليزية' : 'Switch language to Arabic'}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {next === 'ar' ? 'العربية' : 'English'}
    </Button>
  );
}
