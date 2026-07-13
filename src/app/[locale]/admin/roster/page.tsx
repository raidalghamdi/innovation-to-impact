import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { getRoleIcon } from '@/lib/role-icons';
import { Users, Mail, Bell, Settings2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// src/app/[locale]/admin/roster/page.tsx
// Roster hub: shows every role with counts (active members, pending invites, accepted, declined)
// and quick links to the per-role management page + settings + templates.

type RoleStat = {
  code: string;
  name_ar: string | null;
  name_en: string | null;
  active: number;
  pending: number;
  accepted: number;
  declined: number;
};

async function getRosterStats(): Promise<RoleStat[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: roles } = await admin
    .schema('innovation')
    .from('roles')
    .select('id, code, name_ar, name_en')
    .eq('is_active', true)
    .order('code');
  if (!roles) return [];

  const { data: userRoles } = await admin
    .schema('innovation')
    .schema('innovation').from('v_user_roles')
    .select('role_code, role_active');
  const { data: invitations } = await admin
    .schema('innovation')
    .from('invitations')
    .select('role, status');

  return roles.map((r: any) => {
    const activeCount = (userRoles ?? []).filter(
      (ur: any) => ur.role_code === r.code && ur.role_active !== false
    ).length;
    const invs = (invitations ?? []).filter((i: any) => i.role === r.code);
    return {
      code: r.code,
      name_ar: r.name_ar,
      name_en: r.name_en,
      active: activeCount,
      pending: invs.filter((i: any) => i.status === 'sent' || i.status === 'viewed' || i.status === 'pending').length,
      accepted: invs.filter((i: any) => i.status === 'accepted').length,
      declined: invs.filter((i: any) => i.status === 'declined').length,
    };
  });
}

export default async function RosterHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('roster');
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const stats = await getRosterStats();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title={t('title')}
          subtitle={t('description')}
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/invitation-templates"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" />
                {t('manageTemplates')}
              </Link>
              <Link
                href="/admin/invitation-settings"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" />
                {t('settings')}
              </Link>
            </div>
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => {
            const Icon = getRoleIcon(s.code) ?? Users;
            const roleName = isAr ? s.name_ar ?? s.code : s.name_en ?? s.code;
            return (
              <Link
                key={s.code}
                href={`/admin/roster/${s.code}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-400 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-teal-50 p-2 text-teal-700 group-hover:bg-teal-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-900">{roleName}</div>
                      <div className="text-xs text-slate-500">{s.code}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-teal-700">{s.active}</div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-amber-50 p-2">
                    <div className="font-semibold text-amber-700">{s.pending}</div>
                    <div className="text-amber-600">{t('pending')}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <div className="font-semibold text-emerald-700">{s.accepted}</div>
                    <div className="text-emerald-600">{t('accepted')}</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2">
                    <div className="font-semibold text-rose-700">{s.declined}</div>
                    <div className="text-rose-600">{t('declined')}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
