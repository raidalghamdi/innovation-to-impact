import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getOpenEscalations } from '@/lib/escalations';
import { fetchUsers } from '@/lib/data';
import { EscalationBoard, type EscalationRow } from '@/components/escalation-board';

export const dynamic = 'force-dynamic';

export default async function EscalationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('escalations');

  const [escalations, users] = await Promise.all([getOpenEscalations(), fetchUsers()]);
  const nameById = new Map(users.map((u) => [u.id, u.full_name ?? u.email ?? null]));

  const rows: EscalationRow[] = escalations.map((e) => ({
    id: e.id,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    opened_at: e.opened_at,
    reason_ar: e.reason_ar,
    reason_en: e.reason_en,
    current_level: e.current_level,
    current_owner_id: e.current_owner_id,
    owner_name: e.current_owner_id ? nameById.get(e.current_owner_id) ?? null : null,
    status: e.status,
  }));

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EscalationBoard initial={rows} locale={locale} />
    </AppShell>
  );
}
