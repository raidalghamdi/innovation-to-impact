// Maps each editable cms_blocks row (page::section::key) to the translation
// dot-path used as its live fallback on the site. Kept in sync with each
// page's `getText(...)` calls; when a page adds a new getText fallback,
// add a matching entry here so the CMS editor can pre-fill it.
//
// Consumed by the CMS editor to display the CURRENT text on the site as
// the starting value in the empty EN/AR fields — so admins can tweak a
// single word instead of retyping the whole paragraph from scratch.

import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';

// (page, section, key) -> dot-path into messages/{locale}.json
// Special-case: landing page uses flat namespace with camelCase keys.
const MAP: Record<string, string> = {
  // ─── Landing ───────────────────────────────────────────────
  'landing::hero::eyebrow': 'landing.heroEyebrow',
  'landing::hero::title': 'landing.heroTitle',
  'landing::hero::primary_cta': 'landing.heroPrimaryCta',
  'landing::hero::learn_more': 'landing.ctaExplore',
  'landing::how_it_works::title': 'landing.howItWorksTitle',
  'landing::how_it_works::subtitle': 'landing.howItWorksSubtitle',
  'landing::cta_footer::title': 'landing.finalCtaTitle',
  'landing::cta_footer::subtitle': 'landing.finalCtaSubtitle',
  'landing::cta_footer::button': 'landing.stickyCta',

  // ─── About ─────────────────────────────────────────────────
  'about::intro::title': 'about.title',
  'about::intro::body': 'about.subtitle',

  // ─── Evaluation criteria ──────────────────────────────────
  'evaluation_criteria::intro::title': 'evaluationCriteria.title',
  'evaluation_criteria::intro::body': 'evaluationCriteria.subtitle',

  // ─── Events ────────────────────────────────────────────────
  'events::intro::title': 'events.title',
  'events::intro::body': 'events.subtitle',

  // ─── Expected solutions ────────────────────────────────────
  'expected_solutions::intro::title': 'expectedSolutions.title',
  'expected_solutions::intro::body': 'expectedSolutions.subtitle',

  // ─── FAQ ──────────────────────────────────────────────────
  'faq::intro::title': 'faq.title',
  'faq::intro::subtitle': 'faq.subtitle',

  // ─── Partners ──────────────────────────────────────────────
  'partners::intro::title': 'partners.title',
  'partners::intro::subtitle': 'partners.subtitle',

  // ─── Roadmap ───────────────────────────────────────────────
  'roadmap::intro::title': 'roadmap.title',
  'roadmap::intro::body': 'roadmap.subtitle',

  // ─── Support ───────────────────────────────────────────────
  'support::intro::title': 'support.title',
  'support::intro::body': 'support.subtitle',

  // ─── Target audience ───────────────────────────────────────
  'target_audience::intro::title': 'targetAudience.title',
  'target_audience::intro::body': 'targetAudience.subtitle',
};

function readPath(obj: unknown, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return '';
    }
  }
  return typeof cur === 'string' ? cur : '';
}

/**
 * Return the current default (i.e. the text shown on the site when no admin
 * override exists) for a given cms block. Returns an empty string when no
 * mapping is known — the editor will fall back to the placeholder in that case.
 */
export function defaultTextFor(
  page: string,
  section: string,
  key: string | null,
  locale: 'en' | 'ar'
): string {
  if (!key) return '';
  const path = MAP[`${page}::${section}::${key}`];
  if (!path) return '';
  const source = locale === 'ar' ? arMessages : enMessages;
  return readPath(source, path);
}
