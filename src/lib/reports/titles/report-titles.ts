// Editable chart-title overrides for the rich screen reports, backed by the
// existing `innovation.report_titles` table (key text PK + bilingual title/
// subtitle columns). Titles are keyed per chart, scope-agnostic, so an admin
// edit is reflected in both the admin and supervisor variants of a screen.
//
//   key format: `screen:<screenKey>:<chartId>`   e.g. `screen:analytics:ideasByStage`
//
// Reads go through the RLS server client (admins have full access per the
// table's policy); when Supabase is unconfigured everything degrades to the
// i18n defaults so builds/previews still render.
//
// Server-only module (not a "use server" action module, since it also exports a
// pure `resolveTitle` helper). Track K can re-export `saveReportTitle` from its
// own `'use server'` file to expose it to client components.
import { createClient } from '@/lib/supabase/server';

export type TitleOverride = {
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
};

// Drop any admin./supervisor. prefix so both scopes share the same override.
function screenKey(screenId: string): string {
  return screenId.replace(/^(admin|supervisor)\./, '');
}

function titleKey(screenId: string, chartId: string): string {
  return `screen:${screenKey(screenId)}:${chartId}`;
}

// Return per-chart overrides for a screen, keyed by chartId. Missing rows are
// simply absent from the map (callers fall back to the i18n default title).
export async function getReportTitles(screenId: string): Promise<Record<string, TitleOverride>> {
  const out: Record<string, TitleOverride> = {};
  const sb = await createClient();
  if (!sb) return out;
  const prefix = `screen:${screenKey(screenId)}:`;
  try {
    const { data, error } = await sb
      .from('report_titles')
      .select('key, title_ar, title_en, subtitle_ar, subtitle_en')
      .like('key', `${prefix}%`);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[getReportTitles] supabase error:', error.message);
      return out;
    }
    for (const row of (data as Array<{ key: string } & TitleOverride> | null) ?? []) {
      const chartId = row.key.slice(prefix.length);
      out[chartId] = {
        title_ar: row.title_ar,
        title_en: row.title_en,
        subtitle_ar: row.subtitle_ar,
        subtitle_en: row.subtitle_en,
      };
    }
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getReportTitles] threw:', err);
    return out;
  }
}

export type SaveResult = { ok: boolean; error?: string };

// Upsert a bilingual title override for a single chart. Wired to the Edit
// Titles UI (Track K). Empty strings are stored as null so a cleared field
// falls back to the i18n default.
export async function saveReportTitle(
  screenId: string,
  chartId: string,
  ar: string,
  en: string,
  subtitleAr?: string,
  subtitleEn?: string
): Promise<SaveResult> {
  const sb = await createClient();
  if (!sb) return { ok: false, error: 'supabase-unconfigured' };
  const nz = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
  try {
    const { error } = await sb.from('report_titles').upsert(
      {
        key: titleKey(screenId, chartId),
        title_ar: nz(ar),
        title_en: nz(en),
        subtitle_ar: nz(subtitleAr),
        subtitle_en: nz(subtitleEn),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// Pick the effective title for a chart: override (locale-aware) → provided i18n
// default. Pure/synchronous so the PDF/PPTX renderers can call it per chart.
export function resolveTitle(
  override: TitleOverride | undefined,
  i18nDefault: string,
  locale: 'ar' | 'en'
): string {
  if (override) {
    const v = locale === 'ar' ? override.title_ar : override.title_en;
    if (v && v.trim()) return v;
  }
  return i18nDefault;
}
