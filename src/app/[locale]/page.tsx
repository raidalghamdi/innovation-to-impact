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
import { getCurrentUser } from '@/lib/user';
import { ROLE_HOME } from '@/lib/roles';
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
  Globe,
  Store,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Leaf,
  Gavel,
  Cpu,
  Handshake,
  BarChart3,
  Rocket,
  Wrench,
  Expand,
  Presentation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Map a strategic theme to a meaningful icon. We resolve by:
//   1. Known seed IDs (stable across environments — fastest, exact),
//   2. Keyword match on the Arabic/English name (covers new themes that
//      admins might add via the CMS without needing a code change),
//   3. Fallback to Target.
function pickThemeIcon(theme: { id?: string; name_ar?: string | null; name_en?: string | null }): LucideIcon {
  const idTail = (theme.id ?? '').slice(-4).toLowerCase();
  const byId: Record<string, LucideIcon> = {
    '0001': Globe,        // Digital-markets competition
    '0002': Store,        // SMEs empowerment
    '0003': Scale,        // Regulatory efficiency & transparency
  };
  if (byId[idTail]) return byId[idTail];

  const hay = `${theme.name_ar ?? ''} ${theme.name_en ?? ''}`.toLowerCase();
  const contains = (...words: string[]) => words.some((w) => hay.includes(w));

  if (contains('digital', 'رقم', 'e-commerce', 'platform', 'منص')) return Globe;
  if (contains('sme', 'منش', 'small', 'صغير', 'startup', 'رياد')) return Store;
  if (contains('regulator', 'تنظيم', 'transpar', 'شفاف', 'compliance', 'التزام')) return Scale;
  if (contains('protect', 'حماية', 'consumer', 'مستهلك')) return ShieldCheck;
  if (contains('innovat', 'ابتكار', 'creativ', 'إبداع')) return Sparkles;
  if (contains('collab', 'تعاون', 'partner', 'شراك')) return Handshake;
  if (contains('data', 'بيانات', 'analytic', 'تحليل')) return BarChart3;
  if (contains('ai', 'artificial', 'ذكاء', 'tech', 'تقن', 'technology')) return Cpu;
  if (contains('sustain', 'استدام', 'green', 'أخضر', 'environment', 'بيئ')) return Leaf;
  if (contains('law', 'قانون', 'enforce', 'إنفاذ')) return Gavel;
  if (contains('empower', 'تمكين', 'growth', 'نمو', 'accelerat')) return Rocket;
  if (contains('citizen', 'مواطن', 'community', 'مجتمع', 'people', 'أفراد')) return Users;

  return Target;
}

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
  // Detect logged-in user so the landing nav can render the role menu instead
  // of the generic "Login" CTA (fixes the "looks-logged-out" regression).
  const currentUser = await getCurrentUser();
  const faqItems = (t.raw('faq.items') as { q: string; a: string }[]).slice(0, 8);
  const partners = (t.raw('partners.partners') as { name: string }[]);
  const objectives = t.raw('landing.objectives.items') as string[];
  const rules = t.raw('landing.details.rules') as string[];
  const criteriaItems = t.raw('landing.criteria.items') as { label: string; description?: string; weight: number }[];
  // Fixed brand-aligned palette — each criterion gets a stable identity color.
  const CRIT_COLORS = ['#01696F', '#20808D', '#D19900', '#A84B2F', '#7A7974'];
  const CRIT_ICONS: LucideIcon[] = [Sparkles, Rocket, Wrench, Expand, Presentation];
  const critSegments = criteriaItems.map((item, i) => ({
    ...item,
    color: CRIT_COLORS[i % CRIT_COLORS.length],
    Icon: CRIT_ICONS[i % CRIT_ICONS.length],
  }));
  const prizeItems = t.raw('landing.prizes.items') as { tier: string; value: string }[];
  const heroWords = t.raw('landing.hero.words') as string[];
  const previousGallery = t.raw('landing.previous.gallery') as string[];

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />

      {/* Unified public Nav Bar (shared across all pre-login pages) */}
      <LandingNav
        locale={locale}
        user={
          currentUser
            ? { displayName: currentUser.fullName || currentUser.email || 'User', role: currentUser.role }
            : null
        }
      />

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
                href={(currentUser ? ROLE_HOME[currentUser.role] : '/ideas/new') as any}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Lightbulb className="h-5 w-5" />
                {currentUser
                  ? (locale === 'ar' ? 'لوحتي' : 'My dashboard')
                  : t('landing.hero.ctaRegister')}
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
              {themes.slice(0, 6).map((theme) => {
                const Icon = pickThemeIcon(theme);
                return (
                <Link
                  key={theme.id}
                  href={`/tracks/${theme.id}` as any}
                  className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition hover:border-brand-teal/40 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal transition group-hover:bg-brand-teal group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-brand-teal">
                    {pickFromRow(theme, 'name', locale)}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
                    {theme.description}
                  </p>
                </Link>
                );
              })}
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

        {/* ===== 8. CRITERIA (redesigned July 2026) ===== */}
        {/* Full-bleed dark section with a live donut chart on one side and
            a rich list of icon‑badged criteria on the other. Segments in the
            donut match the badges by color so the eye connects them
            immediately. All animation is CSS — respects reduced-motion via
            the global stylesheet. */}
        <section
          id="criteria"
          className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-brand-teal-dark via-[#0c3a3f] to-[#0a1e21] py-20 text-white sm:py-28"
        >
          {/* Ambient glows */}
          <div className="pointer-events-none absolute -top-24 end-1/4 h-72 w-72 rounded-full bg-brand-cyan/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 start-1/4 h-72 w-72 rounded-full bg-brand-gold/15 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand-cyan-light sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
                {t('landing.criteria.eyebrow')}
              </p>
              <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                {t('landing.criteria.title')}
              </h2>
              <p className="mt-3 text-sm text-white/70 sm:text-base">
                {t('landing.criteria.lead')}
              </p>
            </div>

            {/* Full-width list — the weights are fixed policy (25/25/20/20/10),
                not live data. A chart implies dynamism the values don't have,
                so we drop the side panel and let the list breathe across the
                full column. */}
            <ol className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {critSegments.map((s, i) => {
                const Icon = s.Icon;
                return (
                  <li
                    key={i}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08] sm:p-6"
                  >
                    {/* Left color bar tied to the criterion identity */}
                    <span
                      className="absolute inset-y-0 start-0 w-1"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
                        style={{ backgroundColor: `${s.color}22`, color: s.color }}
                        aria-hidden="true"
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                            <span className="me-2 text-xs font-medium text-white/40 tabular-nums">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            {s.label}
                          </h3>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums text-white"
                            style={{ backgroundColor: s.color }}
                          >
                            {s.weight}%
                          </span>
                        </div>
                        {s.description && (
                          <p className="mt-2 text-sm leading-relaxed text-white/75">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
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
