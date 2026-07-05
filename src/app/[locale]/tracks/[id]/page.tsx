import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { fetchThemes, fetchIdeas, fetchCompliance } from '@/lib/data';
import { pickFromRow } from '@/lib/i18n-content';
import { Link } from '@/i18n/routing';
import { Target, Lightbulb } from 'lucide-react';

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [themes, ideas, compliance] = await Promise.all([
    fetchThemes(),
    fetchIdeas(),
    fetchCompliance(),
  ]);

  const theme = themes.find((th) => th.id === id);
  if (!theme) notFound();

  const trackIdeas = ideas.filter((i: any) => i.strategic_theme_id === id).slice(0, 6);

  return (
    <PublicShell locale={locale}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
          <Target className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-teal sm:text-2xl">
            {pickFromRow(theme, 'name', locale)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{theme.description}</p>
        </div>
      </div>

      {/* Related ideas under this track */}
      {trackIdeas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-brand-teal">{t('ideas.title')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {trackIdeas.map((idea: any) => (
              <Link
                key={idea.id}
                href={`/ideas/${idea.id}` as any}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40"
              >
                <Lightbulb className="h-4 w-4 shrink-0 text-brand-teal" />
                <span className="line-clamp-1 text-sm font-medium text-foreground">
                  {pickFromRow(idea, 'title', locale) || idea.code}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Accordion sections migrated from deleted /strategy /benefits /compliance pages ===== */}
      <section className="mt-10 space-y-3">
        <details className="group rounded-2xl border border-border bg-card p-4 open:shadow-sm">
          <summary className="cursor-pointer list-none text-base font-semibold text-brand-teal">
            {t('strategy.title')}
          </summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>{t('strategy.subtitle')}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-foreground">{t('strategy.priority')}</dt>
                <dd>{theme.priority}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground">{t('strategy.description')}</dt>
                <dd>{theme.description}</dd>
              </div>
            </dl>
          </div>
        </details>

        <details className="group rounded-2xl border border-border bg-card p-4 open:shadow-sm">
          <summary className="cursor-pointer list-none text-base font-semibold text-brand-teal">
            {t('benefits.title')}
          </summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>{t('benefits.subtitle')}</p>
            <p>
              {t('benefits.financial')} · {t('benefits.nonFinancial')} · {t('benefits.category')}
            </p>
          </div>
        </details>

        <details className="group rounded-2xl border border-border bg-card p-4 open:shadow-sm">
          <summary className="cursor-pointer list-none text-base font-semibold text-brand-teal">
            {t('compliance.title')}
          </summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>{t('compliance.subtitle')}</p>
            {compliance.length > 0 && (
              <ul className="list-inside list-disc space-y-1">
                {compliance.slice(0, 5).map((c: any) => (
                  <li key={c.id}>
                    {c.regulator} — {c.clause}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </section>
    </PublicShell>
  );
}
