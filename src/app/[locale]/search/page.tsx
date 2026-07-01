import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { SearchClient } from '@/components/search-client';

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('placeholder')}</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <SearchClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
