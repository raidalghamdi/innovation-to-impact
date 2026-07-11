'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ClipboardCheck, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EvEmptyState } from '@/components/evaluator/ev-ui';

export type EvalRow = {
  id: string;
  title: string;
  category: string | null;
  date: string | null;
  score: number | null;
};

type Sort = 'newest' | 'highest' | 'lowest';

export function MyEvaluationsList({ locale, rows }: { locale: string; rows: EvalRow[] }) {
  const t = useTranslations('evaluator');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('__all__');
  const [sort, setSort] = useState<Sort>('newest');

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean) as string[])),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (cat !== '__all__') list = list.filter((r) => r.category === cat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === 'highest') sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    else if (sort === 'lowest') sorted.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    else sorted.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return sorted;
  }, [rows, cat, search, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--ink)]">{t('navCompleted')}</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('myEvaluationsSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--ink-faint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus:border-[var(--gold)]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="highest">{t('sortHighest')}</option>
          <option value="lowest">{t('sortLowest')}</option>
        </select>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button className="ev-chip" data-active={cat === '__all__'} onClick={() => setCat('__all__')}>
            {t('allCategories')}
          </button>
          {categories.map((c) => (
            <button key={c} className="ev-chip" data-active={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EvEmptyState icon={ClipboardCheck} title={t('emptyEvaluationsTitle')} hint={t('emptyEvaluationsHint')} />
      ) : (
        <ul className="ev-card divide-y divide-[var(--line)]">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/evaluator/ideas/${r.id}` as any}
                className="flex items-center justify-between gap-4 p-4 hover:bg-[var(--paper)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--ink)]">{r.title}</p>
                  <p className="ev-num mt-0.5 text-xs text-[var(--ink-faint)]">
                    {r.category ? `${r.category} · ` : ''}
                    {r.date ? formatDate(r.date, locale) : ''}
                  </p>
                </div>
                {r.score != null && (
                  <span className="ev-num ev-badge-gold shrink-0">{r.score}/40</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
