import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { InvitationTemplatesManager } from '@/components/invitation-templates-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailTestMode, getEmailTestRecipient } from '@/lib/email-test-mode';

// src/app/[locale]/admin/invitation-templates/page.tsx
// Edit invite/accept/reject/reminder templates per role, with attachments.

export default async function InvitationTemplatesPage({
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

  const t = await getTranslations('invitations.testMode');
  const testMode = isEmailTestMode();
  const testRecipient = getEmailTestRecipient();

  const admin = createAdminClient();
  const { data: templates } = await admin!
    .schema('innovation')
    .from('email_templates')
    .select('*')
    .order('kind');
  const { data: attachments } = await admin!
    .schema('innovation')
    .from('email_template_attachments')
    .select('*');

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title={isAr ? 'قوالب دعوات البريد' : 'Invitation Email Templates'}
          subtitle={
            isAr
              ? 'حرِّر رسائل الدعوة والقبول والرفض والتذكير لكل دور، وأدر المرفقات.'
              : 'Edit invite / accept / reject / reminder emails per role and manage attachments.'
          }
        />
        {testMode && testRecipient && (
          <div
            role="alert"
            className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          >
            {t('banner', { recipient: testRecipient })}
          </div>
        )}
        <InvitationTemplatesManager
          templates={(templates ?? []) as any[]}
          attachments={(attachments ?? []) as any[]}
          locale={isAr ? 'ar' : 'en'}
        />
      </div>
    </AppShell>
  );
}
