import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import {
  Sparkles,
  Target,
  Compass,
  Workflow,
  Users,
  Building2,
  Layers,
  UserPlus,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { loadCms, getText, isSectionEnabled } from '@/lib/cms';
import { loadMediaAsset } from '@/lib/media-assets';
import { pick } from '@/lib/i18n-content';

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tp = await getTranslations('partners');
  const cms = await loadCms('about');
  // Optional hero banner uploaded via /admin/cms → Media → about.header.image.
  const headerImage = await loadMediaAsset('about.header.image');

  const participants = t.raw('participants.items') as { title: string; body: string }[];
  const partners = tp.raw('partners') as { name: string }[];
  const participantIcons = [Users, Layers, UserPlus];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      {/* 1. Hero */}
      {isSectionEnabled(cms, 'intro') && (
        <section className="relative overflow-hidden rounded-3xl border border-brand-teal/15 bg-gradient-to-br from-brand-teal-light via-white to-brand-cyan/20 px-6 py-14 sm:px-12 sm:py-20">
          {/* Optional uploaded banner — sits behind the gradient as a subtle wash. */}
          {headerImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={headerImage.url}
              alt={pick(headerImage.alt_ar, headerImage.alt_en, locale) ?? ''}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-multiply"
              loading="eager"
            />
          )}
          <div className="pointer-events-none absolute -top-16 end-[-40px] hidden h-48 w-48 rounded-full bg-brand-cyan/25 blur-3xl sm:block" />
          <div className="pointer-events-none absolute -bottom-20 start-[-30px] hidden h-56 w-56 rounded-full bg-brand-teal/15 blur-3xl sm:block" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-brand-teal shadow-sm ring-1 ring-brand-teal/15">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{getText(cms, 'intro', 'title', locale, t('title'))}</span>
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-brand-teal sm:text-5xl">
              {t('hero.headline')}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {t('hero.subheadline')}
            </p>
          </div>
        </section>
      )}

      {/* 2. Vision & Mission */}
      {(isSectionEnabled(cms, 'vision') || isSectionEnabled(cms, 'mission')) && (
        <section className="mt-12">
          <div className="grid gap-4 md:grid-cols-2">
            {isSectionEnabled(cms, 'vision') && (
              <Card className="border-brand-teal/15 transition-shadow hover:shadow-md">
                <CardHeader className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
                    <Compass className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-brand-teal">{t('vision.label')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t('vision.body')}</p>
                </CardContent>
              </Card>
            )}
            {isSectionEnabled(cms, 'mission') && (
              <Card className="border-brand-teal/15 transition-shadow hover:shadow-md">
                <CardHeader className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15 text-brand-gold">
                    <Target className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-brand-teal">{t('mission.label')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t('mission.body')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* 3. The Pipeline (CMS key: strategy) */}
      {isSectionEnabled(cms, 'strategy') && (
      <section className="mt-12">
        <Card className="border-brand-teal/15">
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
              <Workflow className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-brand-teal">{t('pipeline.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('pipeline.body')}
              </p>
            </div>
            <div className="shrink-0">
              <Button asChild>
                <Link href="/stages" className="inline-flex items-center gap-2">
                  <span>{t('pipeline.cta')}</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
      )}

      {/* 4. Who Can Participate (CMS key: goals) */}
      {isSectionEnabled(cms, 'goals') && (
      <section className="mt-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-brand-teal">{t('participants.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('participants.subtitle')}</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {participants.map((p, i) => {
            const Icon = participantIcons[i] ?? Users;
            return (
              <Card key={i} className="border-brand-teal/15 transition-shadow hover:shadow-md">
                <CardHeader className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base text-brand-teal">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      )}

      {/* 5. Partners */}
      {isSectionEnabled(cms, 'partners') && (
      <section className="mt-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-brand-teal">{t('partnersSection.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('partnersSection.subtitle')}</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {partners.map((p, i) => (
            <Card
              key={i}
              className="flex flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:border-brand-teal/40"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-brand-teal/30 bg-brand-teal-light text-brand-teal">
                <Building2 className="h-7 w-7" />
              </div>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
            </Card>
          ))}
        </div>
      </section>
      )}

      {/* 6. Contact */}
      {isSectionEnabled(cms, 'contact') && (
      <section className="mt-12 mb-4">
        <Card className="border-brand-teal/20 bg-gradient-to-br from-brand-teal-light/60 to-white">
          <CardContent className="flex flex-col items-start gap-6 p-6 sm:p-8 md:flex-row md:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-teal shadow-sm ring-1 ring-brand-teal/15">
              <Mail className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-brand-teal">{t('contact.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('contact.body')}</p>
              <a
                href={`mailto:${t('contact.email')}`}
                className="mt-3 inline-flex text-sm font-medium text-brand-teal underline-offset-4 hover:underline"
                dir="ltr"
              >
                {t('contact.email')}
              </a>
            </div>
            <div className="shrink-0">
              <Button asChild>
                <a href={`mailto:${t('contact.email')}`} className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{t('contact.cta')}</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
      )}
    </PublicShell>
  );
}
