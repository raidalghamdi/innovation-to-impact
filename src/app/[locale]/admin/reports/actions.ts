'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';

export type TitlePatch = {
  key: string;
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
};

export type SaveTitlesResult = { ok: true } | { ok: false; error: string };

// Upsert one or more editable report/chart titles. Admin-only; the underlying
// innovation.report_titles RLS also enforces this, but we gate here so a
// non-admin never reaches the write. Blank strings are stored as NULL so the
// page falls back to its hardcoded default for that field.
export async function updateReportTitles(patches: TitlePatch[]): Promise<SaveTitlesResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { ok: false, error: 'forbidden' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const norm = (v: string | null) => {
    const t = (v ?? '').trim();
    return t.length > 0 ? t : null;
  };

  const rows = patches
    .filter((p) => typeof p.key === 'string' && p.key.length > 0)
    .map((p) => ({
      key: p.key,
      title_ar: norm(p.title_ar),
      title_en: norm(p.title_en),
      subtitle_ar: norm(p.subtitle_ar),
      subtitle_en: norm(p.subtitle_en),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { ok: false, error: 'no_rows' };

  const { error } = await supabase.from('report_titles').upsert(rows, { onConflict: 'key' });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[updateReportTitles] upsert error:', error);
    return { ok: false, error: error.message };
  }

  revalidatePath('/[locale]/admin/reports', 'page');
  return { ok: true };
}
