import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchUsers, fetchAuditLogs } from '@/lib/data';
import { getCurrentUser } from '@/lib/user';
import { MyEscalationsStrip } from '@/components/my-escalations-strip';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const tc = await getTranslations('categories');
  const users = await fetchUsers();
  const audit = await fetchAuditLogs(8);
  const user = await getCurrentUser();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {user && <MyEscalationsStrip userId={user.id} role={user.role} locale={locale} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('users')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="teal-header">
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">Name</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">Email</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('roles')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('department')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase">{t('userCategory')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-xs text-brand-teal">{u.role}</span>
                    </td>
                    <td className="px-4 py-3">{u.department}</td>
                    <td className="px-4 py-3">{tc(u.user_category as any)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('auditLog')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t('auditEmpty')}</p>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{a.action}</span>{' '}
                  <span className="text-muted-foreground">on {a.entity_type}</span>
                </div>
                <div className="text-end text-xs text-muted-foreground">
                  <p className="font-mono">{a.actor_id?.slice(0, 8) ?? '—'}</p>
                  <p dir="ltr">{a.created_at?.slice(0, 19).replace('T', ' ')}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
