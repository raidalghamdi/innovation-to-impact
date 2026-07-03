import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { CoBrand } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/site-footer';
import { Countdown } from '@/components/countdown';
import { StickyCta } from '@/components/sticky-cta';
import { Button } from '@/components/ui/button';
import { StatsBlock } from '@/components/stats-block';
import { BackToTop } from '@/components/back-to-top';
import { getStats } from '@/lib/demo-data';
import { loadCms, getText, isSectionEnabled } from '@/lib/cms';
import {
  Lightbulb,
  ArrowRight,
  Send,
  ClipboardCheck,
  CheckCircle2,
  Rocket,
  Users,
  ScrollText,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// The hero countdown reads NEXT_PUBLIC_SUBMISSION_DEADLINE. If the env var
// is missing or unparseable the Countdown component renders nothing.

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const stats = getStats();
  const cms = await loadCms('landing');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const faqItems = (t.raw('faq.items') as { q: string; a: string }[]).slice(0, 3);
  const partners = (t.raw('partners.partners') as { name: string }[]).slice(0, 6);

  const steps = [
    { Icon: Send, key: 'step1' },
    { Icon: ClipboardCheck, key: 'step2' },
    { Icon: CheckCircle2, key: 'step3' },
    { Icon: Rocket, key: 'step4' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <CoBrand className="h-12" locale={locale} />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/about">{t('footer.about')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/roadmap">{t('footer.roadmap')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/faq">{t('footer.faq')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t('nav.login')}</Link>
          </Button>
          <LanguageToggle />
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-brand-teal via-brand-teal to-brand-teal-dark text-white">
        <div className="pointer-events-none absolute -end-20 -top-20 h-80 w-80 rounded-full bg-brand-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-20 h-80 w-80 rounded-full bg-brand-cyan-light/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-cyan-light">
            {getText(cms, 'hero', 'eyebrow', locale, t('landing.heroEyebrow'))}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {getText(cms, 'hero', 'title', locale, t('landing.heroTitle'))}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
            {getText(cms, 'hero', 'subtitle', locale, t('landing.heroSubtitle'))}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gold">
              <Link href="/ideas/new">
                <Lightbulb className="h-5 w-5" />
                {getText(cms, 'hero', 'primary_cta', locale, t('landing.heroPrimaryCta'))}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/5 text-white hover:bg-white/15">
              <Link href="/about">{getText(cms, 'hero', 'learn_more', locale, t('landing.learnMore'))}</Link>
            </Button>
          </div>

          {isSectionEnabled(cms, 'countdown') && (
            <div className="mt-10 max-w-xl">
              <Countdown />
            </div>
          )}
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      {isSectionEnabled(cms, 'stats') && (
      <section id="stats" className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">{t('landing.statsTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('landing.statsSubtitle')}</p>
        </div>
        <StatsBlock stats={stats} locale={locale} />
      </section>
      )}

      {/* ===== How it works — 4 steps ===== */}
      {isSectionEnabled(cms, 'how_it_works') && (
      <section className="border-y border-border bg-brand-teal-light/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {getText(cms, 'how_it_works', 'title', locale, t('landing.fourStepsTitle'))}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{getText(cms, 'how_it_works', 'subtitle', locale, t('landing.howItWorksSubtitle'))}</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.key} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal text-white">
                    <s.Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-cyan">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-brand-teal">
                  {t(`landing.${s.key}Title`)}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`landing.${s.key}Desc`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="border-brand-teal text-brand-teal hover:bg-brand-teal-light">
              <Link href="/stages">
                {t('landing.viewAllStages')}
                <Chevron className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      )}

      {/* ===== Preview cards: audience + criteria ===== */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/target-audience" className="group rounded-3xl border border-border bg-card p-6 transition hover:border-brand-teal/40 hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-brand-teal">{t('landing.audiencePreviewTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('landing.audiencePreviewDesc')}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal group-hover:gap-2">
              {t('footer.targetAudience')} <Chevron className="h-4 w-4" />
            </span>
          </Link>
          <Link href="/evaluation-criteria" className="group rounded-3xl border border-border bg-card p-6 transition hover:border-brand-teal/40 hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
              <ScrollText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-brand-teal">{t('landing.criteriaPreviewTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('landing.criteriaPreviewDesc')}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal group-hover:gap-2">
              {t('footer.evaluationCriteria')} <Chevron className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* ===== Partners strip ===== */}
      {isSectionEnabled(cms, 'partners') && (
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <h2 className="text-center text-xl font-bold text-brand-teal">{t('landing.partnersTitle')}</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {partners.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 text-brand-teal" />
                {p.name}
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Button asChild variant="ghost" size="sm" className="text-brand-teal">
              <Link href="/partners">
                {t('footer.partners')} <Chevron className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      )}

      {/* ===== FAQ preview ===== */}
      {isSectionEnabled(cms, 'faq_preview') && (
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-8">
        <h2 className="text-center text-2xl font-bold text-brand-teal sm:text-3xl">{t('landing.faqTitle')}</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {faqItems.map((it, i) => (
            <div key={i} className="px-4 py-4">
              <p className="text-sm font-medium text-foreground">{it.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{it.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="outline" className="border-brand-teal text-brand-teal hover:bg-brand-teal-light">
            <Link href="/faq">
              {t('landing.faqViewAll')} <Chevron className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
      )}

      {/* ===== Final CTA ===== */}
      {isSectionEnabled(cms, 'cta_footer') && (
      <section className="border-t border-border bg-gradient-to-br from-brand-teal-light/60 to-brand-cyan-light/40">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-8">
          <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">{getText(cms, 'cta_footer', 'title', locale, t('landing.finalCtaTitle'))}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {getText(cms, 'cta_footer', 'subtitle', locale, t('landing.finalCtaSubtitle'))}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link href="/ideas/new">
                <Lightbulb className="h-4 w-4" />
                {getText(cms, 'cta_footer', 'button', locale, t('landing.heroPrimaryCta'))}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      )}

      <SiteFooter locale={locale} />
      <BackToTop label={t('common.backToTop')} />
      <StickyCta />
    </div>
  );
}
