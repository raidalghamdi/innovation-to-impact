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
  // Landing-page partner names — sourced from partners.partners[i].name.
  // The number after the underscore is 1-based; the JSON array is 0-based.
  'landing::partners::partner_1_name': 'partners.partners.0.name',
  'landing::partners::partner_2_name': 'partners.partners.1.name',
  'landing::partners::partner_3_name': 'partners.partners.2.name',
  'landing::partners::partner_4_name': 'partners.partners.3.name',
  'landing::partners::partner_5_name': 'partners.partners.4.name',
  'landing::partners::partner_6_name': 'partners.partners.5.name',
  'landing::partners::partner_7_name': 'partners.partners.6.name',
  'landing::partners::partner_8_name': 'partners.partners.7.name',

  // ─── Landing · Previous edition ────────────────────────────
  'landing::previous::title': 'landing.previous.title',
  'landing::previous::body': 'landing.previous.body',
  'landing::previous::gallery_title': 'landing.previous.galleryTitle',
  'landing::previous::video_label': 'landing.previous.videoLabel',
  'landing::previous::video_hint': 'landing.previous.videoHint',

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
    if (cur == null) return '';
    // Numeric segment → array index (supports partners.partners.0.name).
    if (Array.isArray(cur) && /^\d+$/.test(p)) {
      cur = cur[Number(p)];
      continue;
    }
    if (typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
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
