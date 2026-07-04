'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { fallbackIdeas } from '@/lib/search-fallback';
import { pickFromRow } from '@/lib/i18n-content';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon } from 'lucide-react';

type Idea = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  status: string | null;
  current_stage: number | null;
  created_at: string | null;
};

export function SearchClient() {
  const t = useTranslations('search');
  const locale = useLocale();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [results, setResults] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const run = useCallback(
    async (query: string) => {
      setLoading(true);
      setRan(true);
      let data: Idea[] = [];
      try {
        const supabase = createClient();
        if (supabase && query) {
          const like = `%${query}%`;
          const res = await supabase
            .from('ideas')
            .select('*')
            .or(
              `title_ar.ilike.${like},title_en.ilike.${like},problem_statement.ilike.${like},proposed_solution.ilike.${like}`
            )
            .limit(50);
          if (res.data) data = res.data as unknown as Idea[];
        }
      } catch {
        /* fall through to demo data */
      }
      if (data.length === 0) {
        const ql = query.toLowerCase();
        data = fallbackIdeas.filter(
          (i) =>
            !ql ||
            (i.title_ar ?? '').toLowerCase().includes(ql) ||
            (i.title_en ?? '').toLowerCase().includes(ql) ||
            (i.problem_statement ?? '').toLowerCase().includes(ql)
        );
      }
      if (status) data = data.filter((i) => i.status === status);
      if (sort === 'newest')
        data.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      setResults(data);
      setLoading(false);
    },
    [status, sort]
  );

  useEffect(() => {
    if (params.get('q')) run(params.get('q')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q.trim());
        }}
        role="search"
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('placeholder')}
            className="ps-9"
            aria-label={t('placeholder')}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('status')}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="submitted">submitted</option>
          <option value="evaluation">evaluation</option>
          <option value="approved">approved</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label={t('sortNewest')}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="score">{t('sortScore')}</option>
          <option value="views">{t('sortViews')}</option>
        </select>
        <Button type="submit">{t('searchButton')}</Button>
      </form>

      <div className="mt-6">
        {loading && <p className="text-sm text-muted-foreground">…</p>}
        {!loading && ran && results.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noResults')}</p>
        )}
        {!loading && results.length > 0 && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {results.length} {t('countLabel')}
            </p>
            <ul className="space-y-3">
              {results.map((i) => {
                const title = pickFromRow(i, 'title', locale);
                return (
                  <li key={i.id}>
                    <Link href={`/ideas/${i.id}` as any}>
                      <Card className="transition-colors hover:border-brand-teal/40">
                        <CardContent className="p-4">
                          <p className="font-medium text-brand-teal">{title}</p>
                          {i.problem_statement && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {i.problem_statement}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
