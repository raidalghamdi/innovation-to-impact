import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { fetchUsers } from '@/lib/data';
import { ChangeRequestBoard, type ChangeRequestRow } from '@/components/change-request-board';

export const dynamic = 'force-dynamic';

// Fetch the change-request queue and stitch requester display names in JS
// (avoids relying on a PostgREST FK embed that may not be configured). Returns
// an empty list when Supabase is offline so the board still renders.
async function fetchChangeRequests(): Promise<ChangeRequestRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) {
    // eslint-disable-next-line no-console
    if (error) console.error('[fetchChangeRequests] error:', error);
    return [];
  }
  const users = await fetchUsers();
  const nameById = new Map(users.map((u) => [u.id, u.full_name ?? u.email ?? null]));
  return (data as Omit<ChangeRequestRow, 'requester_name'>[]).map((r) => ({
    ...r,
    requester_name: r.requested_by ? nameById.get(r.requested_by) ?? null : null,
  }));
}

export default async function ChangeRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('changeRequests');
  const requests = await fetchChangeRequests();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ChangeRequestBoard initial={requests} locale={locale} />
    </AppShell>
  );
}
