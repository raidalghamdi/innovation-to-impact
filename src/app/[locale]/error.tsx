'use client';

/**
 * Locale-aware error boundary for the `[locale]` segment.
 *
 * Next.js renders this whenever a Server Component or nested Client Component
 * throws during a request within `/en/*` or `/ar/*`. The file must be a
 * Client Component and must export a default function accepting `{ error,
 * reset }`.
 *
 * We deliberately do NOT surface the raw `error.message` to the viewer —
 * it may leak internal details. Instead we show the digest (Next hashes the
 * error and exposes a stable `digest` to correlate with server logs) so a
 * user reporting an issue can hand us a reference.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CoBrand } from '@/components/logo';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');
  const tc = useTranslations('common');

  useEffect(() => {
    // Log to the server via console.error — Vercel captures stderr and
    // ships it to the logs. We include the digest so an operator can grep
    // for the exact failure the user hit.
    // eslint-disable-next-line no-console
    console.error('[locale error]', error.digest, error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#error-main"
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
        id="error-main"
        role="main"
        className="flex flex-1 items-center justify-center px-4 py-16"
      >
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-xl text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-brand-teal sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t('description')}
          </p>
          {error.digest && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('referenceLabel')}:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {error.digest}
              </code>
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('retry')}
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                {t('homeCta')}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
