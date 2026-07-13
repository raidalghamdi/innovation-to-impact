import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect, notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveRoles, isCurrentUserAdmin } from '@/lib/db-roles';
import { UserRoleEditorClient } from '@/components/user-role-editor-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// src/app/[locale]/admin/users/[id]/page.tsx:1
// Phase 11.3 — role assignment editor for a single user: checkboxes for every
// active role + one radio for "primary". Saves to innovation.user_roles via
// PATCH /api/admin/users/[id].
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const isAr = locale === 'ar';

  const actor = await getCurrentUser();
  if (!actor || !(await isCurrentUserAdmin(actor.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  if (!admin) {
    redirect(`/${locale}/admin/users`);
  }

  const { data: targetUser } = await admin
    .from('user_profiles')
    .select('id, full_name, full_name_ar, email, department')
    .eq('id', id)
    .maybeSingle();

  if (!targetUser) {
    notFound();
  }

  const [allRoles, { data: assignedRows }] = await Promise.all([
    getActiveRoles(),
    admin
      .schema('innovation')
      .schema('innovation').from('v_user_roles')
      .select('role_id, is_primary')
      .eq('user_id', id)
      .eq('role_active', true),
  ]);

  return (
    <AppShell>
      <PageHeader
        title={isAr ? targetUser.full_name_ar || targetUser.full_name : targetUser.full_name}
        subtitle={targetUser.email}
      />
      <UserRoleEditorClient
        userId={id}
        locale={locale}
        allRoles={allRoles.map((r) => ({
          id: r.id,
          code: r.code,
          name_ar: r.name_ar,
          name_en: r.name_en,
        }))}
        initialAssigned={(assignedRows ?? []).map((r) => ({ roleId: r.role_id, isPrimary: r.is_primary }))}
      />
    </AppShell>
  );
}
