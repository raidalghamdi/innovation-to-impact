import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { RosterManager } from '@/components/roster-manager';
import type { RoleCode } from '@/lib/invitations';

// src/app/[locale]/admin/roster/[role]/page.tsx
// Per-role roster management: shows active members + all invitations,
// with bulk-select, invite/remind/withdraw actions.

const VALID_ROLES: RoleCode[] = [
  'innovator',
  'supervisor',
  'expert',
  'committee',
  'judge',
  'admin',
  'mentor',
];

export default async function RosterRolePage({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale, role } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('roster');
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  if (!VALID_ROLES.includes(role as RoleCode)) {
    redirect(`/${locale}/admin/roster`);
  }

  const roleCode = role as RoleCode;
  const admin = createAdminClient();

  // Load role info
  const { data: roleInfo } = await admin!
    .schema('innovation')
    .from('roles')
    .select('id, code, name_ar, name_en')
    .eq('code', roleCode)
    .maybeSingle();
  const roleName = isAr ? roleInfo?.name_ar ?? roleCode : roleInfo?.name_en ?? roleCode;

  // Active members
  const { data: userRoles } = await admin!
    .schema('innovation')
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleInfo?.id ?? '');
  const activeUserIds = (userRoles ?? []).map((r: any) => r.user_id);

  // Get emails from auth.users
  const { data: authList } = await admin!.auth.admin.listUsers({ perPage: 500 });
  const activeMembers = (authList?.users ?? [])
    .filter((u) => activeUserIds.includes(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? '',
      name:
        (u.user_metadata as any)?.full_name ??
        (u.user_metadata as any)?.name ??
        null,
    }));

  // Invitations
  const { data: invitations } = await admin!
    .schema('innovation')
    .from('invitations')
    .select('*')
    .eq('role', roleCode)
    .order('created_at', { ascending: false });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title={`${t('managing')} · ${roleName}`}
          subtitle={t('roleDescription')}
        />

        <RosterManager
          role={roleCode}
          roleName={roleName as string}
          activeMembers={activeMembers}
          invitations={(invitations ?? []) as any[]}
          locale={isAr ? 'ar' : 'en'}
        />
      </div>
    </AppShell>
  );
}
