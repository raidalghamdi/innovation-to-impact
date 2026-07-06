import { getTranslations } from 'next-intl/server';
import { LandingNav } from '@/components/landing-nav';
import { SiteFooter } from '@/components/site-footer';
import { Breadcrumbs, type Crumb } from '@/components/breadcrumbs';
import { BackToTop } from '@/components/back-to-top';
import { SkipToContent } from '@/components/skip-to-content';

/**
 * Shared chrome for public (pre-login) pages.
 *
 * Uses the unified `LandingNav` so the top bar is identical across the home
 * page and every other public page (tracks, terms, privacy, events, etc.).
 * Anchor links become smart: on `/` they smooth-scroll to the target section,
 * on any other public page they navigate to `/[locale]/#section`.
 */
export async function PublicShell({
  children,
  locale,
  breadcrumbs,
}: {
  children: React.ReactNode;
  locale: string;
  breadcrumbs?: Crumb[];
}) {
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipToContent targetId="main-content" />
      <LandingNav locale={locale} />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} locale={locale} />}
          {children}
        </div>
      </main>

      <SiteFooter locale={locale} />
      <BackToTop label={t('common.backToTop')} />
    </div>
  );
}
