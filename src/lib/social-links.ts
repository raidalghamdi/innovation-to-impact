/**
 * Single source of truth for public social profile URLs.
 *
 * DO NOT hardcode these URLs anywhere else in the codebase.
 * Search callers with:  grep -rn "SOCIAL_LINKS" src
 *
 * If GAC changes a handle:
 *   1. Update the URL below.
 *   2. Every consumer picks it up automatically on next build.
 *
 * NEVER replace a real URL with an empty string, "#", or a bare domain
 * (e.g. "https://twitter.com") — that's what caused prior regressions.
 */

export type SocialLink = {
  /** Stable machine id — used as React key and for testing. */
  id: 'linkedin' | 'twitter' | 'youtube';
  /** Full absolute URL to the GAC profile on that platform. */
  href: string;
  /** Human-readable label for aria-label / tooltips (not localized). */
  label: string;
};

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    id: 'linkedin',
    href: 'https://www.linkedin.com/company/gac-ksa',
    label: 'LinkedIn',
  },
  {
    id: 'twitter',
    href: 'https://twitter.com/GAC_KSA',
    label: 'X (Twitter)',
  },
  {
    id: 'youtube',
    href: 'https://www.youtube.com/@GAC_KSA',
    label: 'YouTube',
  },
] as const;
