import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { fetchThemes, fetchIdeas, fetchCompliance } from '@/lib/data';
import { pickFromRow } from '@/lib/i18n-content';
import { getTrackChallenges } from '@/lib/tracks';
import { Link } from '@/i18n/routing';
import { Target, Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';

const ACCENTS = ['cyan', 'gold', 'teal'] as const;

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

  const themeIndex = themes.findIndex((th) => th.id === id);
  const theme = themeIndex >= 0 ? themes[themeIndex] : undefined;
  if (!theme) notFound();

  const accent = ACCENTS[(themeIndex < 0 ? 0 : themeIndex) % ACCENTS.length];
  const accentText =
    accent === 'gold' ? 'text-brand-gold' : accent === 'teal' ? 'text-brand-teal' : 'text-brand-cyan';
  const accentBar =
    accent === 'gold' ? 'bg-brand-gold' : accent === 'teal' ? 'bg-brand-teal' : 'bg-brand-cyan';

  const trackIdeas = ideas.filter((i: any) => i.strategic_theme_id === id).slice(0, 6);
  const challenges = getTrackChallenges(id, locale);
  const trackName = pickFromRow(theme, 'name', locale);

  return (
    <PublicShell locale={locale}>
      {/* Track hero */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-brand-teal to-brand-teal-dark p-6 text-white sm:p-8">
        <p className={`inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ${accentText}`}>
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trackPage.eyebrow')}
        </p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{trackName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{theme.description}</p>
        <span className={`mt-4 block h-1 w-16 rounded-full ${accentBar}`} aria-hidden="true" />
      </div>

      {/* نبذة — Overview */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-teal">{t('trackPage.introTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('trackPage.introBody')}</p>
      </section>

      {/* تفاصيل — Details */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-teal">{t('trackPage.detailsTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('trackPage.detailsBody')}</p>
      </section>

      {/* التحديات — Challenges */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-teal">{t('trackPage.challengesTitle')}</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {challenges.map((c, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${accentText}`} aria-hidden="true" />
              <span className="text-sm text-foreground">{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mt-8 flex flex-col items-start gap-4 rounded-3xl border border-brand-teal/30 bg-brand-teal-light/40 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-semibold text-brand-teal">{trackName}</p>
        <Button asChild size="lg" variant="gold">
          <Link href={`/ideas/new?track=${id}` as any}>
            <Lightbulb className="h-5 w-5" />
            {t('trackPage.cta')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </section>

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
