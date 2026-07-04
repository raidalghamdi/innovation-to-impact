// Helpers for rendering DB-stored bilingual content (parallel `_ar` / `_en`
// columns). See docs/bilingual-schema-convention.md for the column contract.
//
// `locale` is typed as `string` (not `'ar' | 'en'`) because route params thread
// the locale through the app as a plain string; any value other than 'ar'
// resolves to the English variant.

/** Pick the Arabic or English value based on the active locale. */
export function pick<T>(ar: T, en: T, locale: string): T {
  return locale === 'ar' ? ar : en;
}

/**
 * Pick a bilingual value from a DB row by base field name, applying the
 * fallback convention:
 *   AR locale → `${field}_ar` ?? `${field}_en` ?? ''
 *   EN locale → `${field}_en` ?? `${field}_ar` ?? ''
 */
export function pickFromRow<T>(
  row: T,
  field: string,
  locale: string
): string {
  const r = row as Record<string, unknown>;
  const ar = r[`${field}_ar`];
  const en = r[`${field}_en`];
  const primary = locale === 'ar' ? ar : en;
  const secondary = locale === 'ar' ? en : ar;
  return String(primary ?? secondary ?? '');
}

/**
 * Server-only convenience: resolves the active locale via next-intl so callers
 * in Server Components / actions don't have to thread `locale`. Uses a dynamic
 * import so this module stays client-safe (client components can import `pick`
 * and `pickFromRow` without pulling in the server-only `next-intl/server`).
 */
export async function pickServer<T>(
  row: T,
  field: string
): Promise<string> {
  const { getLocale } = await import('next-intl/server');
  const locale = await getLocale();
  return pickFromRow(row, field, locale);
}
