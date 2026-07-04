import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { WorkloadHeatmap } from '@/components/workload-heatmap';
import { AssignmentsManager } from '@/components/assignments-manager';
import {
  fetchAssignmentsPage,
  fetchWorkloadHeatmap,
  fetchIdeaOptions,
  fetchEvaluatorOptions,
  ASSIGNMENT_STATUSES,
  type AssignmentFilters,
} from '@/lib/data';

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

export default async function AssignmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('admin.assignments');

  const filters: AssignmentFilters = {
    evaluatorId: first(sp.evaluatorId) || undefined,
    status: first(sp.status) || undefined,
    ideaSearch: first(sp.ideaSearch) || undefined,
    page: Number(first(sp.page)) || 1,
    pageSize: PAGE_SIZE,
  };

  const [{ rows, total, page, pageSize }, heatmap, ideaOptions, evaluatorOptions] = await Promise.all([
    fetchAssignmentsPage(filters),
    fetchWorkloadHeatmap(),
    fetchIdeaOptions(),
    fetchEvaluatorOptions(),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const baseQuery: Record<string, string> = {
    evaluatorId: filters.evaluatorId ?? '',
    status: filters.status ?? '',
    ideaSearch: filters.ideaSearch ?? '',
  };

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <WorkloadHeatmap rows={heatmap} locale={locale} />

      <Card className="mt-6">
        <CardContent className="p-4">
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterEvaluator')}
              <select
                name="evaluatorId"
                defaultValue={filters.evaluatorId ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="">{t('allEvaluators')}</option>
                {evaluatorOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.email || o.full_name || o.id}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterStatus')}
              <select
                name="status"
                defaultValue={filters.status ?? ''}
                className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground"
              >
                <option value="">{t('allStatuses')}</option>
                {ASSIGNMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`status_${s}`)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              {t('filterIdea')}
              <input
                name="ideaSearch"
                defaultValue={filters.ideaSearch ?? ''}
                placeholder={t('filterIdeaPlaceholder')}
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

      <div className="mt-6">
        <AssignmentsManager rows={rows} ideaOptions={ideaOptions} evaluatorOptions={evaluatorOptions} locale={locale} />
      </div>

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
