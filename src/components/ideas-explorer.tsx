'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Search, Sparkles, Inbox } from 'lucide-react';
import type { Idea, StrategicTheme, Activity } from '@/lib/demo-data';
import { PIPELINE_STATUSES } from '@/lib/demo-data';
import { pickFromRow } from '@/lib/i18n-content';

const STATUSES = [
  'draft', 'submitted', 'screening', 'evaluation', 'committee',
  'approved', 'rejected', 'returned', 'assigned', 'in_pilot',
  'in_implementation', 'benefits_tracking', 'closed',
];

export function IdeasExplorer({
  ideas,
  themes,
  activities,
  locale,
}: {
  ideas: Idea[];
  themes: StrategicTheme[];
  activities: Activity[];
  locale: string;
}) {
  const t = useTranslations('ideas');
  const tc = useTranslations('common');
  const te = useTranslations('emptyStates');
  const sp = useSearchParams();
  const pipelineOnly = sp.get('pipeline') === '1';
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [theme, setTheme] = useState(sp.get('theme') ?? '');
  const [status, setStatus] = useState(sp.get('status') ?? '');
  const [activity, setActivity] = useState(sp.get('activity') ?? '');
  const [stage, setStage] = useState(sp.get('stage') ?? '');

  const filtered = useMemo(() => {
    return ideas.filter((i) => {
      if (q) {
        const hay = `${i.code} ${i.title_ar} ${i.title_en} ${i.category}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (theme && i.strategic_theme_id !== theme) return false;
      if (status && i.status !== status) return false;
      if (activity && i.activity_id !== activity) return false;
      if (stage !== '' && String(i.current_stage) !== stage) return false;
      if (pipelineOnly && !PIPELINE_STATUSES.includes(i.status)) return false;
      return true;
    });
  }, [ideas, q, theme, status, activity, stage, pipelineOnly]);

  // naive similarity hint based on shared category/theme
  function similar(i: Idea) {
    return ideas.filter(
      (o) => o.id !== i.id && (o.category === i.category || o.strategic_theme_id === i.strategic_theme_id)
    ).length;
  }

  const selectClass =
    'h-10 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc('search')}
            aria-label={tc('search')}
            className="ps-9"
          />
        </div>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className={selectClass} aria-label={t('filterTheme')}>
          <option value="">{t('filterTheme')}: {tc('all')}</option>
          {themes.map((th) => (
            <option key={th.id} value={th.id}>{pickFromRow(th, 'name', locale)}</option>
          ))}
        </select>
        <select value={activity} onChange={(e) => setActivity(e.target.value)} className={selectClass} aria-label={t('filterActivity')}>
          <option value="">{t('filterActivity')}: {tc('all')}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{pickFromRow(a, 'name', locale)}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label={t('filterStatus')}>
          <option value="">{t('filterStatus')}: {tc('all')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={selectClass} aria-label={t('filterStage')}>
          <option value="">{t('filterStage')}: {tc('all')}</option>
          {Array.from({ length: 9 }).map((_, i) => (
            <option key={i} value={String(i)}>{i}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        stage !== '' || pipelineOnly ? (
          <EmptyState
            icon={Inbox}
            title={te('stageTitle')}
            description={te('stageBody')}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t('emptyRepo')}
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((idea) => {
            const sim = similar(idea);
            return (
              <Link key={idea.id} href={`/ideas/${idea.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-brand-gold">{idea.code}</span>
                      <StatusBadge status={idea.status} locale={locale} />
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {pickFromRow(idea, 'title', locale)}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {idea.problem_statement}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                      <span>{tc('stage')} {idea.current_stage}</span>
                      {sim > 0 && (
                        <span className="inline-flex items-center gap-1 text-brand-teal">
                          <Sparkles className="h-3 w-3" />
                          {sim} {t('similarityHint')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
