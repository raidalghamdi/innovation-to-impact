import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { NotificationsList } from '@/components/notifications-list';
import { getCurrentUser } from '@/lib/user';
import { createClient } from '@/lib/supabase/server';

type NotifEmptyRole = 'innovator' | 'admin' | 'supervisor' | 'evaluator' | 'judge' | 'default';

// Resolve the viewer's primary role for the empty-state copy. Uses the same
// innovation.v_user_roles view as getCurrentUser, but keeps supervisor and
// admin distinct (getCurrentUser collapses supervisor -> admin for nav).
// Priority: admin > supervisor > judge > evaluator > innovator > default.
async function resolveEmptyRole(userId: string): Promise<NotifEmptyRole> {
  const supabase = await createClient();
  if (!supabase) return 'default';
  try {
    const { data } = await supabase
      .schema('innovation').from('v_user_roles')
      .select('role_code, role_active')
      .eq('user_id', userId);
    const codes = new Set(
      ((data as { role_code?: string; role_active?: boolean }[]) ?? [])
        .filter((r) => r.role_active !== false)
        .map((r) => (r.role_code ?? '').toLowerCase())
    );
    if (codes.has('admin')) return 'admin';
    if (codes.has('supervisor')) return 'supervisor';
    if (codes.has('judge') || codes.has('committee')) return 'judge';
    if (codes.has('evaluator')) return 'evaluator';
    if (codes.has('innovator') || codes.has('submitter')) return 'innovator';
  } catch {
    // v_user_roles unreachable — fall through to default.
  }
  return 'default';
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('notifications');

  const user = await getCurrentUser();
  const emptyRole = user ? await resolveEmptyRole(user.id) : 'default';

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-6">
        <NotificationsList emptyRole={emptyRole} />
      </div>
    </AppShell>
  );
}
