import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { Almarai, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { EvaluatorChrome } from '@/components/evaluator/evaluator-chrome';
import './theme.css';

// B0 fonts — scoped to the evaluator area via the layout wrapper only. Global
// typography is untouched.
const almarai = Almarai({
  subsets: ['arabic'],
  weight: ['400', '700', '800'],
  variable: '--font-almarai',
  display: 'swap',
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-ar',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export default async function EvaluatorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();

  // Unread notification count powers the red dots in the topbar + tabbar.
  let unread = 0;
  const supabase = await createClient();
  if (supabase && user) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);
    unread = count ?? 0;
  }

  const displayName = user?.fullName || user?.email || (locale === 'ar' ? 'مقيّم' : 'Evaluator');

  return (
    <div
      className={`ev-root ${almarai.variable} ${plexArabic.variable} ${plexMono.variable}`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <EvaluatorChrome locale={locale} userName={displayName} unread={unread}>
        {children}
      </EvaluatorChrome>
    </div>
  );
}
