import Image from 'next/image';
import { useTranslations } from 'next-intl';

// Brand logos.
// - Logo: Competition Innovation Program mark (existing). Supports white variant for dark backgrounds.
// - GacLogo: Parent authority (General Authority for Competition) — colored and white variants.
// - CoBrand: Program mark + vertical divider + GAC parent logo. Used in header/footer/hero
//   to signal parent–child brand relationship per user direction (co-brand approach).
//
// Perf note: SVGs are treated as static assets and served via next/image so future
// swaps to raster (or CDN transforms) get automatic optimization. PNG variants
// get resize + WebP conversion for free.
//
// A11y note: alt text is fetched via next-intl (`brand.logo.*`) so it renders in
// the active locale (Arabic on /ar/*, English on /en/*).

// Intrinsic image dimensions (used for next/image aspect-ratio hint).
// Both marks had massive baked-in transparent padding in the source files:
// - Program SVG canvas was 841.9x595.3 but content only occupies ~798x286
//   (aspect 2.79:1) — we retightened the viewBox in the source file.
// - GAC PNGs were 646x439 with ~60% transparent whitespace; we cropped them
//   to their content (615x190, aspect 3.24:1).
// So both marks are now horizontally-oriented at roughly the same aspect,
// which lets them share the same `h-*` class without one looking dwarfed.
const PROGRAM_MARK_DIM = { width: 798, height: 286 };
const WORDMARK_AR_DIM = { width: 220, height: 64 };
const GAC_LOGO_DIM = { width: 615, height: 190 };

export function Logo({
  className = 'h-8',
  white = false,
  locale,
  showWordmark = true,
}: {
  className?: string;
  white?: boolean;
  locale?: string;
  showWordmark?: boolean;
}) {
  const t = useTranslations('brand.logo');

  const mark = white
    ? '/brand/Competition-Innovation-Program-logo-white.svg'
    : '/brand/Competition-Innovation-Program-logo.svg';

  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src={mark}
        alt={t('programMark')}
        width={PROGRAM_MARK_DIM.width}
        height={PROGRAM_MARK_DIM.height}
        priority
        className={`${className} w-auto`}
      />
      {showWordmark && locale === 'ar' && (
        <Image
          src="/brand/brnmj-btkr-lmnfs.svg"
          alt={t('wordmarkAr')}
          width={WORDMARK_AR_DIM.width}
          height={WORDMARK_AR_DIM.height}
          className={`${className} w-auto`}
        />
      )}
    </span>
  );
}

export function GacLogo({
  className = 'h-8',
  white = false,
}: {
  className?: string;
  white?: boolean;
}) {
  const t = useTranslations('brand.logo');
  const src = white
    ? '/brand/gac-authority-white.png'
    : '/brand/gac-authority-colored.png';
  return (
    <Image
      src={src}
      alt={t('gacAuthority')}
      width={GAC_LOGO_DIM.width}
      height={GAC_LOGO_DIM.height}
      className={`${className} w-auto`}
    />
  );
}

// CoBrand pairs the Program mark + a vertical divider + the GAC parent mark.
// - white=true  → fully-white variants of both marks (for dark surfaces: hero, footer)
// - white=false → natural colored variants (for light headers, cards)
//
// Visual balancing:
// Even after cropping both source files to content, the two marks have
// different aspect ratios (Program 2.79:1, GAC 3.24:1). Applying the same
// `h-*` class makes GAC render ~16% wider than the Program mark — visually
// unbalanced (GAC appears "bigger"). To match perceived size, we scale GAC
// down so its rendered WIDTH matches the Program mark's width:
//   GAC height factor = 2.79 / 3.24 ≈ 0.86
// Implemented with a plain CSS transform + origin so layout math stays with
// the height-based `className`, and neither PNG needs regenerating.
export function CoBrand({
  className = 'h-12',
  white = false,
  locale,
}: {
  className?: string;
  white?: boolean;
  locale?: string;
}) {
  const dividerColor = white ? 'bg-white/40' : 'bg-slate-300';
  return (
    <span className="inline-flex items-center gap-3">
      <Logo className={className} white={white} locale={locale} showWordmark={false} />
      <span className={`h-8 w-px ${dividerColor}`} aria-hidden="true" />
      {/* Scale GAC ~14% down so its width visually matches the Program mark. */}
      <GacLogo className={`${className} scale-[0.86] origin-center`} white={white} />
    </span>
  );
}
