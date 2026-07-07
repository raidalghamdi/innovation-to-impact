import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { InvitationTemplatesManager } from '@/components/invitation-templates-manager';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const admin = createAdminClient();
  const { data: templates } = await admin!
    .schema('innovation')
    .from('email_templates')
    .select('*')
    .order('role')
    .order('kind');
  const { data: attachments } = await admin!
    .schema('innovation')
    .from('email_template_attachments')
    .select('*');
  const { data: roles } = await admin!
    .schema('innovation')
    .from('roles')
    .select('code, name_ar, name_en')
    .eq('is_active', true)
    .order('code');

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
        <InvitationTemplatesManager
          templates={(templates ?? []) as any[]}
          attachments={(attachments ?? []) as any[]}
          roles={(roles ?? []) as any[]}
          locale={isAr ? 'ar' : 'en'}
        />
      </div>
    </AppShell>
  );
}
