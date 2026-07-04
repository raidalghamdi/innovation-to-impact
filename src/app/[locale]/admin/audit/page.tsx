import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAuditPage, type AuditFilters } from '@/lib/data';
import { verifyAuditChain } from '@/lib/audit';

const ENTITY_TYPES = ['idea', 'api_request', 'knowledge_article', 'compliance_control', 'support_message'];
const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function buildQuery(base: Record<string, string>, overrides: Record<string, string | number>): string {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries({ ...base, ...overrides })) {
    if (val !== '' && val !== undefined && val !== null) p.set(k, String(val));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('admin.audit');

  const filters: AuditFilters = {
    entityType: first(sp.entityType) || undefined,
    action: first(sp.action) || undefined,
    actorId: first(sp.actorId) || undefined,
    from: first(sp.from) || undefined,
    to: first(sp.to) || undefined,
    page: Number(first(sp.page)) || 1,
    pageSize: PAGE_SIZE,
  };

  const [{ rows, total, page, pageSize, actorLabels }, chain] = await Promise.all([
    fetchAuditPage(filters),
    verifyAuditChain(),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const baseQuery: Record<string, string> = {
    entityType: filters.entityType ?? '',
    action: filters.action ?? '',
    actorId: filters.actorId ?? '',
    from: filters.from ?? '',
    to: filters.to ?? '',
  };

  function isVerified(seq: number | null): boolean {
    if (chain.ok) return true;
    if (seq == null || chain.firstBreakSeq == null) return false;
    return seq < chain.firstBreakSeq;
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/admin/audit/export${buildQuery(baseQuery, {})}`}
            className="rounded-md bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t('export')}
          </a>
          <a
            href={`/api/exports/audit.xlsx${buildQuery(baseQuery, { locale })}`}
            className="rounded-md border border-brand-teal px-4 py-2 text-sm font-medium text-brand-teal hover:bg-brand-teal/10"
          >
            {t('exportXlsx')}
          </a>
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="p-4">
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterEntity')}
              <select
                name="entityType"
                defaultValue={filters.entityType ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="">{t('allEntities')}</option>
                {ENTITY_TYPES.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterAction')}
              <input
                name="action"
                defaultValue={filters.action ?? ''}
                placeholder="committee."
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterActor')}
              <input
                name="actorId"
                defaultValue={filters.actorId ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 font-mono text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterFrom')}
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterTo')}
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-md bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                {t('apply')}
              </button>
              <a href="?" className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                {t('reset')}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colWhen')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colActor')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colAction')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colEntity')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colEntityId')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colSeq')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colVerified')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 text-muted-foreground" dir="ltr">{r.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      <td className="p-3">{r.actor_id ? (actorLabels[r.actor_id] ?? `${r.actor_id.slice(0, 8)}…`) : '—'}</td>
                      <td className="p-3">{r.action}</td>
                      <td className="p-3 text-muted-foreground">{r.entity_type}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground" dir="ltr">{r.entity_id ?? '—'}</td>
                      <td className="p-3 font-mono text-xs" dir="ltr">{r.chain_seq ?? '—'}</td>
                      <td className="p-3">
                        {isVerified(r.chain_seq) ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ {t('verified')}</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">✕ {t('unverified')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('pageOf', { page, pages })}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <a href={buildQuery(baseQuery, { page: page - 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              {t('prev')}
            </a>
          )}
          {page < pages && (
            <a href={buildQuery(baseQuery, { page: page + 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              {t('next')}
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}
