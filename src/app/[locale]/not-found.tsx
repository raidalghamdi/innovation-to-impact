import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { CoBrand } from '@/components/logo';
import { Home, Layers } from 'lucide-react';

/**
 * Locale-aware 404 page (`/en/does-not-exist`, `/ar/...`).
 *
 * Rendered by Next.js whenever a route inside `[locale]` calls `notFound()`
 * or matches nothing. Uses `getTranslations` so the copy reads in the
 * viewer's language and keeps the GAC/Innovation Program brand chrome
 * consistent with the rest of the site.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  const tc = await getTranslations('common');
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#not-found-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-teal focus:px-4 focus:py-2 focus:text-white"
      >
        {tc('skipToContent')}
      </a>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <CoBrand />
        </div>
      </header>
      <main
        id="not-found-main"
        className="flex flex-1 items-center justify-center px-4 py-16"
      >
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-gold">
            404
          </p>
          <h1 className="mt-2 text-3xl font-bold text-brand-teal sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t('description')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                {t('homeCta')}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/stages">
                <Layers className="h-4 w-4" aria-hidden="true" />
                {t('stagesCta')}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
