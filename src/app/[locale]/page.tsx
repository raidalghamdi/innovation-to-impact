import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { Link } from '@/i18n/routing';
import { CoBrand } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/site-footer';
import { Countdown } from '@/components/countdown';
import { StickyCta } from '@/components/sticky-cta';
import { SkipToContent } from '@/components/skip-to-content';
import { Button } from '@/components/ui/button';
import { StatsBlock } from '@/components/stats-block';
import { BackToTop } from '@/components/back-to-top';
import { HeaderSearch } from '@/components/header-search';
import { TimelineModern, stages as defaultStages } from '@/components/timeline-modern';
import { getStats } from '@/lib/demo-data';
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
} from 'lucide-react';

// Anchor nav items — order matches the 12 landing sections.
const ANCHOR_NAV = [
  { href: '#about', key: 'navAbout' },
  { href: '#tracks', key: 'navTracks' },
  { href: '#timeline', key: 'navTimeline' },
  { href: '#criteria', key: 'navCriteria' },
  { href: '#prizes', key: 'navPrizes' },
  { href: '#faq', key: 'navFaq' },
] as const;

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
  const stats = getStats();
  const themes = await fetchThemes();
  const faqItems = (t.raw('faq.items') as { q: string; a: string }[]).slice(0, 8);
  const partners = (t.raw('partners.partners') as { name: string }[]);
  const objectives = t.raw('landing.objectives.items') as string[];
  const rules = t.raw('landing.details.rules') as string[];
  const criteriaItems = t.raw('landing.criteria.items') as string[];
  const prizeItems = t.raw('landing.prizes.items') as { tier: string; value: string }[];

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />

      {/* ===== Top bar (anchor nav + smooth scroll) ===== */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <CoBrand className="h-12" locale={locale} />
        </Link>
        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label={t('footer.quickLinks')}
        >
          {ANCHOR_NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-brand-teal-light hover:text-brand-teal"
            >
              {t(`landing.${n.key}`)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <HeaderSearch />
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t('nav.login')}</Link>
          </Button>
          <LanguageToggle />
        </div>
      </header>

      <main id="main-content">
        {/* ===== 1. HERO ===== */}
        <section
          id="hero"
          className="relative scroll-mt-24 overflow-hidden border-b border-border bg-gradient-to-br from-brand-teal via-brand-teal to-brand-teal-dark py-16 text-white sm:py-24"
        >
          <div className="pointer-events-none absolute -end-20 -top-20 h-80 w-80 rounded-full bg-brand-cyan/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -start-20 h-80 w-80 rounded-full bg-brand-cyan-light/10 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-cyan-light">
              {t('landing.heroEyebrow')}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              {t('landing.heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gold">
                <Link href="/ideas/new">
                  <Lightbulb className="h-5 w-5" />
                  {t('landing.heroCtaRegister')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
              <a
                href="#about"
                className="inline-flex items-center gap-2 rounded-md border border-white/40 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                {t('landing.learnMore')}
              </a>
            </div>

            <div className="mt-10 max-w-xl">
              <Countdown />
            </div>
          </div>
        </section>

        {/* ===== 2. ABOUT ===== */}
        <section id="about" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.about.title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t('landing.about.body')}
            </p>
            <p className="mt-3 rounded-2xl bg-brand-teal-light/40 p-4 text-sm font-medium text-brand-teal">
              {t('landing.about.mission')}
            </p>
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

        {/* ===== 6. NUMBERS ===== */}
        <section id="numbers" className="scroll-mt-24 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
                {t('landing.statsTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('landing.statsSubtitle')}</p>
            </div>
            <StatsBlock stats={stats} locale={locale} />
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
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {criteriaItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
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
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-8">
            <h2 className="text-2xl font-bold text-brand-teal sm:text-3xl">
              {t('landing.previous.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t('landing.previous.body')}
            </p>
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
