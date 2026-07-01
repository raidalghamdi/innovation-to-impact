import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { CoBrand } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/site-footer';
import { Breadcrumbs, type Crumb } from '@/components/breadcrumbs';
import { BackToTop } from '@/components/back-to-top';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/about', key: 'about' },
  { href: '/evaluation-criteria', key: 'evaluationCriteria' },
  { href: '/roadmap', key: 'roadmap' },
  { href: '/events', key: 'events' },
  { href: '/faq', key: 'faq' },
] as const;

// Shared chrome for public marketing / content pages (Phase F).
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
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <CoBrand className="h-8" locale={locale} />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('footer.quickLinks')}>
          {NAV.map((n) => (
            <Button key={n.href} asChild variant="ghost" size="sm">
              <Link href={n.href}>{t(`footer.${n.key}`)}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="gold" className="hidden sm:inline-flex">
            <Link href="/ideas/new">{t('nav.submitIdea')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t('nav.login')}</Link>
          </Button>
          <LanguageToggle />
        </div>
      </header>

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
