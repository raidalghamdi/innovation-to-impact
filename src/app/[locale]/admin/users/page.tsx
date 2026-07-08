import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin, getActiveRoles } from '@/lib/db-roles';
import { UsersManager } from '@/components/users-manager';

// src/app/[locale]/admin/users/page.tsx
// Comprehensive user management: search, filters, KPI strip, and inline
// actions (edit / roles / reset password / activate / deactivate / delete).
// Delegates most interactivity to <UsersManager>.

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; role?: string; category?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  if (!admin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-8 text-slate-500">
          Service unavailable.
        </div>
      </AppShell>
    );
  }

  // Pull profiles + roles + auth metadata in parallel
  const [{ data: profiles }, roles, { data: userRoleRows }, { data: authList }] =
    await Promise.all([
      admin
        .schema('innovation')
        .from('user_profiles')
        .select(
          'id, full_name, full_name_ar, email, department, phone, organization, user_category, language_preference, must_change_password, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(500),
      getActiveRoles(),
      admin
        .schema('innovation')
        .from('user_roles')
        .select('user_id, is_primary, roles!inner(code, name_ar, name_en)'),
      admin.auth.admin.listUsers({ perPage: 500 }),
    ]);

  // Merge auth data (banned_until, last_sign_in_at) with profiles
  const authMap = new Map<string, any>();
  for (const u of authList?.users ?? []) authMap.set(u.id, u);

  // Group roles by user
  const rolesByUser = new Map<string, any[]>();
  for (const r of (userRoleRows ?? []) as any[]) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push({
      code: r.roles.code,
      name_ar: r.roles.name_ar,
      name_en: r.roles.name_en,
      is_primary: r.is_primary,
    });
    rolesByUser.set(r.user_id, list);
  }

  const usersEnriched = (profiles ?? []).map((p: any) => {
    const authU = authMap.get(p.id);
    const bannedUntil = authU?.banned_until ?? null;
    const isActive =
      !bannedUntil || new Date(bannedUntil).getTime() < Date.now();
    return {
      ...p,
      last_sign_in_at: authU?.last_sign_in_at ?? null,
      email_confirmed_at: authU?.email_confirmed_at ?? null,
      is_active: isActive,
      roles: rolesByUser.get(p.id) ?? [],
    };
  });

  const kpi = {
    total: usersEnriched.length,
    active: usersEnriched.filter((u) => u.is_active).length,
    inactive: usersEnriched.filter((u) => !u.is_active).length,
    internal: usersEnriched.filter((u) => u.user_category === 'internal').length,
    external: usersEnriched.filter((u) => u.user_category === 'external').length,
    mustChangePw: usersEnriched.filter((u) => u.must_change_password).length,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title={isAr ? 'إدارة المستخدمين' : 'User Management'}
          subtitle={
            isAr
              ? 'ابحث، عدِّل، أضف مستخدمين، وأدر الأدوار وكلمات المرور والحالة من مكان واحد.'
              : 'Search, edit, add users, and manage roles, passwords, and status \u2014 all from one place.'
          }
        />
        <UsersManager
          users={usersEnriched}
          roles={roles as any[]}
          kpi={kpi}
          locale={isAr ? 'ar' : 'en'}
        />
      </div>
    </AppShell>
  );
}
