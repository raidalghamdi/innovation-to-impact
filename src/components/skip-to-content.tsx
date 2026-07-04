import { useTranslations } from 'next-intl';

/**
 * Visually hidden "Skip to content" link that becomes visible on focus.
 *
 * Rendered as the first focusable element on every page so keyboard and
 * screen-reader users can jump past the header/nav directly into `#main`.
 *
 * The target must be an element with `id="main-content"` (which is the
 * convention used across our shells: `AppShell`, `PublicShell`).
 */
export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  const t = useTranslations('common');
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-teal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2"
    >
      {t('skipToContent')}
    </a>
  );
}
