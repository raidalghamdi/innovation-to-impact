import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { PlatformSettingsClient } from '@/components/platform-settings-client';

// src/app/[locale]/admin/settings/page.tsx:1
// Phase 10.4 — admin panel toggle for innovation.platform_settings, DB-driven
// (no Vercel env vars).
export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  const { data } = admin
    ? await admin.from('platform_settings').select('*').order('key')
    : { data: [] as any[] };

  return (
    <AppShell>
      <PageHeader title={t('settingsTitle')} subtitle={t('settingsSubtitle')} />
      <PlatformSettingsClient settings={data ?? []} locale={locale} />
    </AppShell>
  );
}
