'use client';

/**
 * Notifications-page error boundary.
 *
 * Historical context: /notifications was rendering the generic locale error
 * page ("حدث خطأ غير متوقّع") whenever anything in the notifications data
 * path — realtime handshake, RLS mismatch, absent user session — threw during
 * hydration. The parent [locale]/error.tsx is a full-page fallback that
 * blocks the entire chrome; that's overkill for a notifications tab.
 *
 * This boundary catches the same errors, logs them for observability, and
 * renders a graceful "no notifications yet" empty-state view so the user
 * can still navigate. It is scoped strictly to the /notifications segment.
 */
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { Bell, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('notifications');
  const te = useTranslations('emptyStates');
  const tc = useTranslations('common');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[notifications error]', error.digest, error.message);
  }, [error]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-6">
        <EmptyState
          icon={Bell}
          title={te('notificationsTitle')}
          description={te('notificationsBody')}
        />
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="outline" onClick={() => reset()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {tc('retry')}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
