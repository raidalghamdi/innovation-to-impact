import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { NotificationsList } from '@/components/notifications-list';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('notifications');

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-6">
        <NotificationsList />
      </div>
    </AppShell>
  );
}
