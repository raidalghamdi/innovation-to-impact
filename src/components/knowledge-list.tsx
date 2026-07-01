'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, BookOpen, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { KnowledgeArticle } from '@/lib/demo-data';

const TYPE_FILTERS = ['all', 'official_guide', 'playbook', 'lesson_learned', 'case_study', 'template'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

export function KnowledgeList({
  articles,
  locale,
}: {
  articles: KnowledgeArticle[];
  locale: string;
}) {
  const t = useTranslations('knowledge');
  const tc = useTranslations('common');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = useMemo(() => {
    let list = articles;
    if (typeFilter !== 'all') {
      list = list.filter((a) => a.type === typeFilter);
    }
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((a) =>
        `${a.title_ar} ${a.title_en} ${a.type} ${a.tags.join(' ')}`.toLowerCase().includes(s)
      );
    }
    return list;
  }, [articles, q, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc('search')} className="ps-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                typeFilter === f
                  ? 'bg-brand-teal text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t(`types.${f}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-teal" />
                  <span className="text-xs uppercase tracking-wide text-brand-gold">
                    {t(`types.${a.type}`, { defaultValue: a.type })}
                  </span>
                </div>
                {a.source_url && (
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal/20"
                  >
                    {t('open')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="font-semibold text-foreground">
                {locale === 'ar' ? a.title_ar : a.title_en}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {a.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('published')}:{' '}
                {(locale === 'ar' ? a.source_label_ar : a.source_label_en) ?? formatDate(a.published_at, locale)}
              </p>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </div>
    </div>
  );
}
