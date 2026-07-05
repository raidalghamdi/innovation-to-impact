'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Search as SearchIcon } from 'lucide-react';

// Compact quick-search input shown in the top header (Landing + app shell).
// Submits to /search?q=... — the full search page does the heavy lifting.
export function HeaderSearch() {
  const t = useTranslations('landing');
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? (`/search?q=${encodeURIComponent(query)}` as any) : ('/search' as any));
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative">
      <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="h-10 w-48 rounded-md border border-input bg-white ps-9 pe-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-64"
      />
    </form>
  );
}
