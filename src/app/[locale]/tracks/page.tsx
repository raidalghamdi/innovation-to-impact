import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Link } from '@/i18n/routing';
import { fetchThemes } from '@/lib/data';
import { pickFromRow } from '@/lib/i18n-content';
import { Target, ChevronLeft, ChevronRight } from 'lucide-react';

export default async function TracksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const themes = await fetchThemes();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <PublicShell locale={locale}>
      <h1 className="text-2xl font-bold text-brand-teal sm:text-3xl">{t('sectionTracks')}</h1>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <Link
            key={theme.id}
            href={`/tracks/${theme.id}` as any}
            className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition hover:border-brand-teal/40 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-brand-teal">
              {pickFromRow(theme, 'name', locale)}
            </h3>
            <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{theme.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal group-hover:gap-2">
              {t('navTracks')}
              <Chevron className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
