'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Search } from 'lucide-react';

export function GlobalSearch() {
  const t = useTranslations('search');
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative">
      <label htmlFor="global-search" className="sr-only">
        {t('placeholder')}
      </label>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('placeholder')}
        className="h-9 w-56 rounded-md border border-input bg-white ps-8 pe-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      />
    </form>
  );
}
