'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ArrowRight, Search, Layers } from 'lucide-react';
import { EvEmptyState } from '@/components/evaluator/ev-ui';

export type QueueCard = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  team: string | null;
  submittedAt: string | null;
};

type Sort = 'newest' | 'oldest' | 'az';

export function EvaluatorQueue({ locale, cards }: { locale: string; cards: QueueCard[] }) {
  const t = useTranslations('evaluator');
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('__all__');
  const [sort, setSort] = useState<Sort>('newest');

  const categories = useMemo(
    () => Array.from(new Set(cards.map((c) => c.category).filter(Boolean) as string[])),
    [cards]
  );

  const filtered = useMemo(() => {
    let list = cards;
    if (cat !== '__all__') list = list.filter((c) => c.category === cat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title, locale));
    else
      sorted.sort((a, b) => {
        const av = a.submittedAt ?? '';
        const bv = b.submittedAt ?? '';
        return sort === 'newest' ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    return sorted;
  }, [cards, cat, search, sort, locale]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--ink)]">{t('queueTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('queueSubtitle')}</p>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
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
            <option value="oldest">{t('sortOldest')}</option>
            <option value="az">{t('sortAz')}</option>
          </select>
        </div>

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

        <p className="ev-num text-xs text-[var(--ink-faint)]">
          {t('resultsCount', { n: filtered.length })}
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EvEmptyState icon={Layers} title={t('emptyQueueTitle')} hint={t('emptyQueueHint')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/evaluator/ideas/${c.id}` as any}
              className="ev-idea-card flex flex-col p-5"
            >
              {c.category && (
                <span className="ev-badge-gold self-start">{c.category}</span>
              )}
              <h3 className="ev-clamp-2 mt-3 font-display text-base font-bold leading-snug text-[var(--ink)]">
                {c.title}
              </h3>
              {c.description && (
                <p className="ev-clamp-2 mt-2 text-sm text-[var(--ink-soft)]">{c.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <span className="text-xs text-[var(--ink-faint)]">{t('anonymousIdea')}</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold-deep)]">
                  {t('startReview')}
                  <Arrow className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
