import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationSettingsForm } from '@/components/invitation-settings-form';

export default async function InvitationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  const { data: settings } = await admin!
    .schema('innovation')
    .from('admin_settings')
    .select('key, value')
    .in('key', ['reminder_schedule', 'invitation_defaults']);

  const map: Record<string, any> = {};
  for (const row of settings ?? []) map[(row as any).key] = (row as any).value;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader
          title={isAr ? 'إعدادات الدعوات والتذكيرات' : 'Invitation & Reminder Settings'}
          subtitle={
            isAr
              ? 'اضبط جدولة التذكيرات الآلية والقيم الافتراضية لرسائل الدعوة.'
              : 'Configure automatic reminders and default sender / expiry values.'
          }
        />
        <InvitationSettingsForm
          reminder={map.reminder_schedule ?? {}}
          defaults={map.invitation_defaults ?? {}}
          locale={isAr ? 'ar' : 'en'}
        />
      </div>
    </AppShell>
  );
}
