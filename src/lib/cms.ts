// Granular CMS layer (cms_blocks).
//
// Model: each editable text piece and each toggleable section is a row keyed by
// (page, section, key). key is NULL for section-toggle rows (kind='section').
//
// Consumer pattern (server components):
//   const cms = await loadCms('landing');
//   getText(cms, 'hero', 'title', locale, t('landing.heroTitle'));
//   isSectionEnabled(cms, 'partners');   // defaults to true
//
// Storage: innovation.cms_blocks (see migration 00007). RLS: public read, admin write.

import { createClient } from '@/lib/supabase/server';

export type CmsBlock = {
  page: string;
  section: string;
  key: string | null;
  kind: 'text' | 'richtext' | 'html' | 'section';
  enabled: boolean;
  value_en: string | null;
  value_ar: string | null;
  sort_order: number;
};

export type CmsMap = Map<string, CmsBlock>;

function keyOf(section: string, key: string | null): string {
  return key ? `${section}::${key}` : `${section}::__section__`;
}

/**
 * Load every CMS block for a page in one query. Returns a Map keyed by
 * "section::key" (or "section::__section__" for section toggles).
 *
 * Safe against missing env / schema — always returns an empty map instead of
 * throwing, so pages render fine before the CMS is populated.
 */
export async function loadCms(page: string): Promise<CmsMap> {
  const map = new Map<string, CmsBlock>();
  try {
    const supabase = await createClient();
    if (!supabase) return map;
    const { data, error } = await supabase
      .from('cms_blocks')
      .select('page,section,key,kind,enabled,value_en,value_ar,sort_order')
      .eq('page', page);
    if (error || !data) return map;
    for (const row of data as CmsBlock[]) {
      map.set(keyOf(row.section, row.key), row);
    }
  } catch {
    // fall through — return empty map so callers use fallbacks
  }
  return map;
}

/**
 * Return the localized text for a block, falling back to the passed default
 * (typically a next-intl translation).
 */
export function getText(
  cms: CmsMap,
  section: string,
  key: string,
  locale: string,
  fallback: string
): string {
  const row = cms.get(keyOf(section, key));
  if (!row) return fallback;
  const val = locale === 'ar' ? row.value_ar : row.value_en;
  return (val && val.trim()) ? val : fallback;
}

/**
 * A section is enabled unless an explicit section-toggle row exists with
 * enabled = false. Missing row => enabled (safe default).
 */
export function isSectionEnabled(cms: CmsMap, section: string): boolean {
  const row = cms.get(keyOf(section, null));
  if (!row) return true;
  return row.enabled !== false;
}
