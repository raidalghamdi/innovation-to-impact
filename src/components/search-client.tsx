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
import { Search as SearchIcon, Lightbulb, Target, Users } from 'lucide-react';

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

type Track = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  description: string | null;
};

type Team = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
};

export function SearchClient() {
  const t = useTranslations('search');
  const locale = useLocale();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [results, setResults] = useState<Idea[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const run = useCallback(
    async (query: string) => {
      setLoading(true);
      setRan(true);
      let data: Idea[] = [];
      let trackData: Track[] = [];
      let teamData: Team[] = [];
      try {
        const supabase = createClient();
        if (supabase && query) {
          const like = `%${query}%`;

          const [ideasRes, tracksRes, teamsRes] = await Promise.all([
            supabase
              .from('ideas')
              .select('*')
              .or(
                `title_ar.ilike.${like},title_en.ilike.${like},problem_statement.ilike.${like},proposed_solution.ilike.${like}`
              )
              .limit(50),
            supabase
              .from('strategic_themes')
              .select('id,name_ar,name_en,description')
              .or(`name_ar.ilike.${like},name_en.ilike.${like},description.ilike.${like}`)
              .limit(20),
            supabase
              .from('teams')
              .select('id,name_ar,name_en')
              .or(`name_ar.ilike.${like},name_en.ilike.${like}`)
              .limit(20),
          ]);

          if (ideasRes.data) data = ideasRes.data as unknown as Idea[];
          if (tracksRes.data) trackData = tracksRes.data as unknown as Track[];
          if (teamsRes.data) teamData = teamsRes.data as unknown as Team[];
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
      setTracks(trackData);
      setTeams(teamData);
      setLoading(false);
    },
    [status, sort]
  );

  useEffect(() => {
    if (params.get('q')) run(params.get('q')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCount = results.length + tracks.length + teams.length;

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

      <div className="mt-6 space-y-8">
        {loading && <p className="text-sm text-muted-foreground">…</p>}
        {!loading && ran && totalCount === 0 && (
          <p className="text-sm text-muted-foreground">{t('noResults')}</p>
        )}

        {!loading && results.length > 0 && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-teal">
              <Lightbulb className="h-4 w-4" />
              {t('groupIdeas')} · {results.length}
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
          </div>
        )}

        {!loading && tracks.length > 0 && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-teal">
              <Target className="h-4 w-4" />
              {t('groupTracks')} · {tracks.length}
            </p>
            <ul className="space-y-3">
              {tracks.map((track) => {
                const title = locale === 'ar' ? track.name_ar || track.name_en : track.name_en || track.name_ar;
                const desc = track.description;
                return (
                  <li key={track.id}>
                    <Link href={`/tracks/${track.id}` as any}>
                      <Card className="transition-colors hover:border-brand-teal/40">
                        <CardContent className="p-4">
                          <p className="font-medium text-brand-teal">{title}</p>
                          {desc && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{desc}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!loading && teams.length > 0 && (
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-teal">
              <Users className="h-4 w-4" />
              {t('groupTeams')} · {teams.length}
            </p>
            <ul className="space-y-3">
              {teams.map((team) => {
                const title = locale === 'ar' ? team.name_ar || team.name_en : team.name_en || team.name_ar;
                return (
                  <li key={team.id}>
                    <Card>
                      <CardContent className="p-4">
                        <p className="font-medium text-brand-teal">{title}</p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
