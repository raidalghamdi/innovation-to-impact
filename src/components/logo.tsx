/* eslint-disable @next/next/no-img-element */

// Brand logos.
// - Logo: Competition Innovation Program mark (existing). Supports white variant for dark backgrounds.
// - GacLogo: Parent authority (General Authority for Competition) — colored and white variants.
// - CoBrand: Program mark + vertical divider + GAC parent logo. Used in header/footer/hero
//   to signal parent–child brand relationship per user direction (co-brand approach).

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
  const mark = white
    ? '/brand/Competition-Innovation-Program-logo-white.svg'
    : '/brand/Competition-Innovation-Program-logo.svg';

  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={mark}
        alt="Innovation to Impact — General Authority for Competition"
        className={className}
      />
      {showWordmark && locale === 'ar' && (
        <img
          src="/brand/brnmj-btkr-lmnfs.svg"
          alt="برنامج ابتكار المنافسة"
          className={className}
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
  const src = white
    ? '/brand/gac-authority-white.png'
    : '/brand/gac-authority-colored.png';
  return (
    <img
      src={src}
      alt="General Authority for Competition — الهيئة العامة للمنافسة"
      className={className}
    />
  );
}

// CoBrand pairs the Program mark + a vertical divider + the GAC parent mark.
// Per brand guidance, the logo must ALWAYS sit on a dark background. When
// `white` is true we assume the caller has already put us on a dark surface
// (e.g. hero, footer). Otherwise we render our own dark badge so the logo
// still appears on dark even inside a light header.
export function CoBrand({
  className = 'h-9',
  white = false,
  locale,
}: {
  className?: string;
  white?: boolean;
  locale?: string;
}) {
  // Always use the white/reversed marks — the brand rule is white-on-dark.
  const inner = (
    <span className="inline-flex items-center gap-3">
      <Logo className={className} white locale={locale} showWordmark={false} />
      <span className="h-6 w-px bg-white/30" aria-hidden="true" />
      <GacLogo className={className} white />
    </span>
  );

  if (white) {
    // Caller-provided dark surface (hero/footer) — no extra badge needed.
    return inner;
  }

  // Light-surface caller (header, etc.) — wrap in a dark rounded badge so the
  // logo still meets the brand rule of white-on-dark.
  return (
    <span className="inline-flex items-center rounded-xl bg-brand-teal px-3 py-1.5">
      {inner}
    </span>
  );
}
