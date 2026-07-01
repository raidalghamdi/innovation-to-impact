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

export function CoBrand({
  className = 'h-9',
  white = false,
  locale,
}: {
  className?: string;
  white?: boolean;
  locale?: string;
}) {
  const dividerColor = white ? 'bg-white/30' : 'bg-slate-300';
  return (
    <span className="inline-flex items-center gap-3">
      <Logo className={className} white={white} locale={locale} showWordmark={false} />
      <span className={`h-6 w-px ${dividerColor}`} aria-hidden="true" />
      <GacLogo className={className} white={white} />
    </span>
  );
}
