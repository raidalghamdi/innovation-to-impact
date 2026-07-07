import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { Link } from '@/i18n/routing';
import { SiteFooter } from '@/components/site-footer';
import { Countdown } from '@/components/countdown';
import { StickyCta } from '@/components/sticky-cta';
import { SkipToContent } from '@/components/skip-to-content';
import { Button } from '@/components/ui/button';
import { BackToTop } from '@/components/back-to-top';
import { LandingNav } from '@/components/landing-nav';
import { HeroRotator } from '@/components/hero-rotator';
import { HeroNetwork } from '@/components/hero-network';
import { TimelineModern, stages as defaultStages } from '@/components/timeline-modern';
import { fetchThemes } from '@/lib/data';
import { pickFromRow } from '@/lib/i18n-content';
import {
  Lightbulb,
  ArrowRight,
  Target,
  Building2,
  Award,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  PlayCircle,
} from 'lucide-react';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Touch request headers to force per-request rendering (dynamic countdown).
  headers();
  const t = await getTranslations();
  const themes = await fetchThemes();
  const faqItems = (t.raw('faq.items') as { q: string; a: string }[]).slice(0, 8);
  const partners = (t.raw('partners.partners') as { name: string }[]);
  const objectives = t.raw('landing.objectives.items') as string[];
  const rules = t.raw('landing.details.rules') as string[];
  const criteriaItems = t.raw('landing.criteria.items') as { label: string; weight: number }[];
  const criteriaTotal = criteriaItems.reduce((sum, c) => sum + c.weight, 0);
  const prizeItems = t.raw('landing.prizes.items') as { tier: string; value: string }[];
  const heroWords = t.raw('landing.hero.words') as string[];
  const previousGallery = t.raw('landing.previous.gallery') as string[];

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />

      {/* Unified public Nav Bar (shared across all pre-login pages) */}
      <LandingNav locale={locale} />

      <main id="main-content">
        {/* ===== 1. HERO — Concept ب (Competition Network) ===== */}
        {/* July 2026 redesign v2: the animated node network is now the FULL-BLEED
            background of the hero section (not a side panel). Content sits above
            it centered, with a soft radial vignette so the text stays legible on
            any viewport. */}
        <section
          id="hero"
          className="relative scroll-mt-24 overflow-hidden border-b border-border bg-gradient-to-br from-brand-teal-dark via-brand-teal-dark to-[#0a1e21] py-16 text-white sm:py-24"
        >
          {/* Layer 1: animated network canvas covering the whole section */}
          <HeroNetwork className="pointer-events-none absolute inset-0 h-full w-full" />

          {/* Layer 2: readability veil — darker in the middle-lower area so the
              headline + countdown + CTAs remain crisp, transparent at the edges
              so the network still reads as a background. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-teal-dark/60 via-brand-teal-dark/40 to-brand-teal-dark/70" />

          {/* Layer 3: soft brand glows */}
          <div className="pointer-events-none absolute end-0 top-0 h-64 w-64 rounded-full bg-brand-cyan/10 blur-3xl sm:h-80 sm:w-80" />
          <div className="pointer-events-none absolute bottom-0 start-0 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl sm:h-80 sm:w-80" />

          {/* Layer 4: content, single centered column */}
          <div className="relative mx-auto max-w-3xl space-y-6 px-4 text-center sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-teal-dark/50 px-4 py-1.5 text-xs font-semibold tracking-wider text-brand-cyan-light backdrop-blur-sm sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
              {t('landing.hero.eyebrow')}
              <span className="hidden text-white/50 sm:inline">—</span>
              <span className="hidden text-white/60 sm:inline">{t('landing.hero.partner')}</span>
            </p>

            <h1 className="hero-headline mx-auto max-w-2xl [text-shadow:0_2px_16px_rgba(0,0,0,0.35)]">
              <HeroRotator words={heroWords} />
            </h1>

            {/* Innovate · Compete · Impact — slogan pill row */}
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-base font-semibold text-white/95 sm:text-lg">
              <span>{t('landing.hero.sloganInnovate')}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" aria-hidden="true" />
              <span className="text-brand-cyan-light">{t('landing.hero.sloganCompete')}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
              <span className="text-brand-gold">{t('landing.hero.sloganImpact')}</span>
            </p>

            <p className="mx-auto max-w-xl text-base text-white/85 sm:text-lg [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
              {t('landing.hero.stable')}
            </p>

            {/* CTA order (UX note batch 07/26): learn first, then register. */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="gold">
                <a href="#about">
                  {t('landing.hero.ctaLearn')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </a>
              </Button>
              <Link
                href="/ideas/new"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Lightbulb className="h-5 w-5" />
                {t('landing.hero.ctaRegister')}
              </Link>
            </div>

            <div className="mx-auto max-w-xl pt-2">
              <Countdown />
            </div>
          </div>
        </section>

        {/* ===== 2. ABOUT ===== */}
        <section id="about" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 sm:px-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
                {t('landing.about.title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {t('landing.about.body')}
              </p>
              <p className="mt-4 rounded-2xl bg-brand-teal-light/40 p-4 text-sm font-medium text-brand-teal">
                {t('landing.about.mission')}
              </p>
            </div>
            {/* Image slot — replace with a real photo in public/brand/ later. */}
            <div
              role="img"
              aria-label={t('landing.aboutImageAlt')}
              className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-teal via-brand-teal to-brand-cyan/70"
            >
              <ImageIcon className="h-16 w-16 text-white/40" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* ===== 3. OBJECTIVES ===== */}
        <section id="objectives" className="scroll-mt-24 border-y border-border bg-brand-teal-light/30 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.objectives.title')}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {objectives.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 4. TRACKS ===== */}
        <section id="tracks" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
                {t('landing.sectionTracks')}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {themes.slice(0, 6).map((theme) => (
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
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
                    {theme.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 5. DETAILS ===== */}
        <section id="details" className="scroll-mt-24 border-y border-border bg-card py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.details.title')}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-teal">
                  <ClipboardList className="h-4 w-4" /> {t('landing.details.rulesTitle')}
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {rules.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-brand-teal">
                  {t('landing.details.formatTitle')}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{t('landing.details.format')}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-brand-teal">
                  {t('landing.details.eligibilityTitle')}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('landing.details.eligibility')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 7. TIMELINE ===== */}
        <section id="timeline" className="scroll-mt-24 border-y border-border bg-brand-teal-light/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 className="text-center text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.sectionTimeline')}
            </h2>
            <div className="mt-10">
              <TimelineModern stages={defaultStages} locale={locale} />
            </div>
          </div>
        </section>

        {/* ===== 8. CRITERIA ===== */}
        <section id="criteria" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.criteria.title')}
            </h2>
            <div className="mt-8 space-y-3">
              {criteriaItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-cyan/15 px-3 py-1 text-sm font-bold tabular-nums text-brand-teal">
                      {item.weight}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-cyan"
                      style={{ width: `${item.weight}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-teal bg-brand-teal-light/40 p-4">
                <span className="text-sm font-bold text-brand-teal">
                  {t('landing.criteria.totalLabel')}
                </span>
                <span className="rounded-full bg-brand-teal px-3 py-1 text-sm font-bold tabular-nums text-white">
                  {criteriaTotal}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 9. PRIZES ===== */}
        <section id="prizes" className="scroll-mt-24 border-y border-border bg-card py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-8">
            <h2 className="text-center text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.prizes.title')}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {prizeItems.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-3xl border p-6 text-center ${i === 0 ? 'border-brand-gold bg-brand-gold-light/30' : 'border-border bg-background'}`}
                >
                  <Award className={`mx-auto h-8 w-8 ${i === 0 ? 'text-brand-gold' : 'text-brand-teal'}`} />
                  <h3 className="mt-3 text-base font-semibold text-brand-teal">{p.tier}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 10. PREVIOUS EDITION ===== */}
        <section id="previous" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
                {t('landing.previous.title')}
              </h2>
              <p className="mt-4 text-sm text-muted-foreground sm:text-base">
                {t('landing.previous.body')}
              </p>
            </div>

            {/* Gallery */}
            <h3 className="mt-10 text-lg font-semibold text-brand-teal">
              {t('landing.previous.galleryTitle')}
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previousGallery.map((caption, i) => (
                <figure
                  key={i}
                  className="group flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-brand-teal/10 p-4 text-center transition hover:bg-brand-teal/15"
                >
                  <ImageIcon className="h-10 w-10 text-brand-teal/50" aria-hidden="true" />
                  <figcaption className="text-sm font-medium text-brand-teal">{caption}</figcaption>
                </figure>
              ))}
            </div>

            {/* Video */}
            <h3 className="mt-10 text-lg font-semibold text-brand-teal">
              {t('landing.previous.videoLabel')}
            </h3>
            <div className="mt-4 flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-teal via-brand-teal to-brand-teal-dark text-center">
              <PlayCircle className="h-16 w-16 text-white/60" aria-hidden="true" />
              <p className="text-sm font-medium text-white/80">{t('landing.previous.videoHint')}</p>
            </div>
          </div>
        </section>

        {/* ===== 11. PARTNERS ===== */}
        {partners.length > 0 && (
          <section id="partners" className="scroll-mt-24 border-y border-border bg-card py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-8">
              <h2 className="text-center text-xl font-bold text-brand-teal sm:text-2xl">
                {t('landing.sectionPartners')}
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {partners.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
                  >
                    <Building2 className="h-4 w-4 text-brand-teal" />
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== 12. FAQ ===== */}
        <section id="faq" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <h2 className="text-center text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.faqTitle')}
            </h2>
            <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
              {faqItems.map((it, i) => (
                <details key={i} className="group px-4 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
                    {it.q}
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Final CTA ===== */}
        <section className="border-t border-border bg-gradient-to-br from-brand-teal-light/60 to-brand-cyan-light/40 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.finalCtaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t('landing.finalCtaSubtitle')}
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg">
                <Link href="/ideas/new">
                  <Lightbulb className="h-4 w-4" />
                  {t('landing.heroCtaRegister')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
      <BackToTop label={t('common.backToTop')} />
      <StickyCta />
    </div>
  );
}
