import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRoleIcon } from '@/lib/role-icons';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// src/app/[locale]/admin/users/page.tsx:1
// Phase 11.3 — admin users list: full_name, email, department, role badges,
// with pagination (?page=). Row action links to /admin/users/[id] for role
// editing.
const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const isAr = locale === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = createAdminClient();
  let rows: any[] = [];
  let total = 0;

  if (admin) {
    const { data, count } = await admin
      .from('user_profiles')
      .select('id, full_name, full_name_ar, email, department', { count: 'exact' })
      .order('full_name', { ascending: true })
      .range(from, to);
    rows = data ?? [];
    total = count ?? 0;

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: roleRows } = await admin
        .from('v_user_roles')
        .select('user_id, role_code, role_name_ar, role_name_en, is_primary')
        .in('user_id', ids);
      const rolesByUser = new Map<string, any[]>();
      (roleRows ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r);
        rolesByUser.set(r.user_id, list);
      });
      rows = rows.map((r) => ({ ...r, roles: rolesByUser.get(r.id) ?? [] }));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      <PageHeader
        title={t('usersManagement')}
        subtitle={isAr ? `${total} مستخدم` : `${total} users`}
        action={
          <Link
            href={'/admin/employees/import' as any}
            className="inline-flex items-center rounded-lg bg-brand-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-teal-dark"
          >
            {t('employeesImport')}
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="teal-header">
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">
                  {isAr ? 'الاسم' : 'Name'}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">
                  {isAr ? 'البريد الإلكتروني' : 'Email'}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('department')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('roles')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase">
                  {isAr ? 'إجراء' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {isAr ? 'لا يوجد مستخدمون' : 'No users found'}
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{isAr ? u.full_name_ar || u.full_name : u.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles && u.roles.length > 0 ? (
                        u.roles.map((r: any) => {
                          const Icon = getRoleIcon(r.role_code);
                          return (
                            <span
                              key={r.role_code}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                                r.is_primary
                                  ? 'bg-brand-teal text-white'
                                  : 'bg-brand-teal-light text-brand-teal'
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {isAr ? r.role_name_ar : r.role_name_en}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {isAr ? 'بدون أدوار' : 'No roles'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}` as any}
                      className="text-sm font-medium text-brand-teal hover:underline"
                    >
                      {isAr ? 'تعديل الأدوار' : 'Edit roles'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <Link
              href={`/admin/users?page=${page - 1}` as any}
              aria-disabled={page <= 1}
              className={`inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm ${
                page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-brand-teal-light/40'
              }`}
            >
              <Chevron className="h-4 w-4 rtl:rotate-180" />
              {isAr ? 'السابق' : 'Previous'}
            </Link>
            <span className="text-xs text-muted-foreground">
              {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <Link
              href={`/admin/users?page=${page + 1}` as any}
              aria-disabled={page >= totalPages}
              className={`inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm ${
                page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-brand-teal-light/40'
              }`}
            >
              {isAr ? 'التالي' : 'Next'}
              <Chevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
