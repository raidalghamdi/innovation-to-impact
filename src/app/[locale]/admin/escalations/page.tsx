import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  getEscalations,
  MAX_ESCALATION_LEVEL,
  type EscalationEntity,
  type EscalationStatusFilter,
} from '@/lib/escalations';
import { fetchUsers } from '@/lib/data';
import { EscalationBoard, type EscalationRow } from '@/components/escalation-board';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_VALUES: EscalationStatusFilter[] = ['open', 'resolved', 'all'];
const ENTITY_VALUES: EscalationEntity[] = [
  'idea',
  'evaluation',
  'committee_decision',
  'change_request',
  'sla',
];

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function EscalationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('escalations');

  const statusParam = first(sp.status);
  const status: EscalationStatusFilter = STATUS_VALUES.includes(statusParam as EscalationStatusFilter)
    ? (statusParam as EscalationStatusFilter)
    : 'open';

  const levelNum = Number(first(sp.level));
  const level = levelNum >= 1 && levelNum <= MAX_ESCALATION_LEVEL ? levelNum : undefined;

  const entityParam = first(sp.entityType);
  const entityType = ENTITY_VALUES.includes(entityParam as EscalationEntity)
    ? (entityParam as EscalationEntity)
    : undefined;

  const [escalations, users] = await Promise.all([
    getEscalations({ status, level, entityType }),
    fetchUsers(),
  ]);
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

      <Card className="mb-6">
        <CardContent className="p-4">
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filters.filterStatus')}
              <select
                name="status"
                defaultValue={status}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="open">{t('filters.statusOpen')}</option>
                <option value="resolved">{t('filters.statusResolved')}</option>
                <option value="all">{t('filters.statusAll')}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filters.filterLevel')}
              <select
                name="level"
                defaultValue={level ? String(level) : ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="">{t('filters.allLevels')}</option>
                {Array.from({ length: MAX_ESCALATION_LEVEL }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{t(`level.${n}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filters.filterEntity')}
              <select
                name="entityType"
                defaultValue={entityType ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="">{t('filters.allEntities')}</option>
                {ENTITY_VALUES.map((v) => (
                  <option key={v} value={v}>{t(`entity.${v}`)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-md bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                {t('filters.apply')}
              </button>
              <a href="?" className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                {t('filters.reset')}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <EscalationBoard initial={rows} locale={locale} />
    </AppShell>
  );
}
