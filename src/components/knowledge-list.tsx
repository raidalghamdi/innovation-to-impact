'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, BookOpen } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { KnowledgeArticle } from '@/lib/demo-data';

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

  const filtered = useMemo(() => {
    if (!q) return articles;
    const s = q.toLowerCase();
    return articles.filter((a) =>
      `${a.title_ar} ${a.title_en} ${a.type} ${a.tags.join(' ')}`.toLowerCase().includes(s)
    );
  }, [articles, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc('search')} className="ps-9" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-teal" />
                <span className="text-xs uppercase tracking-wide text-brand-gold">{a.type}</span>
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
                {t('published')}: {formatDate(a.published_at, locale)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
