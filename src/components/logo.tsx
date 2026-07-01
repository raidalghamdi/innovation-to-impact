/* eslint-disable @next/next/no-img-element */

// Brand logo (Phase H). Uses the official Competition Innovation Program marks
// from public/brand/. `white` selects the reversed mark for dark backgrounds.
// When `locale === 'ar'` the Arabic wordmark is shown alongside the emblem.
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
