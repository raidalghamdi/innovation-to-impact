// Dynamic committee (judge) criteria (R43). Reads/writes
// innovation.committee_criteria (00034) — the editable, weighted, bilingual
// criteria the committee scores ideas against. Server-only (RLS-scoped client,
// schema 'innovation'). Degrades to an empty list when Supabase is
// unconfigured.
import { createClient } from '@/lib/supabase/server';

export type CommitteeCriterion = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descAr?: string;
  descEn?: string;
  weight: number;
  active: boolean;
};

type CriterionRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  weight: number | string;
  active: boolean;
};

function fromRow(row: CriterionRow): CommitteeCriterion {
  return {
    id: row.id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    descAr: row.description_ar ?? undefined,
    descEn: row.description_en ?? undefined,
    weight: typeof row.weight === 'number' ? row.weight : Number(row.weight),
    active: row.active,
  };
}

export async function listCommitteeCriteria(
  activeOnly = false
): Promise<CommitteeCriterion[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('committee_criteria')
      .select('id, code, name_ar, name_en, description_ar, description_en, weight, active')
      .order('code', { ascending: true });
    if (activeOnly) query = query.eq('active', true);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as CriterionRow[]).map(fromRow);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[listCommitteeCriteria] threw:', err);
    return [];
  }
}

export async function upsertCommitteeCriterion(
  c: Partial<CommitteeCriterion> & { code: string }
): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const row: Record<string, unknown> = { code: c.code, updated_at: new Date().toISOString() };
  if (c.nameAr !== undefined) row.name_ar = c.nameAr;
  if (c.nameEn !== undefined) row.name_en = c.nameEn;
  if (c.descAr !== undefined) row.description_ar = c.descAr;
  if (c.descEn !== undefined) row.description_en = c.descEn;
  if (c.weight !== undefined) row.weight = c.weight;
  if (c.active !== undefined) row.active = c.active;
  const { error } = await supabase
    .from('committee_criteria')
    .upsert(row, { onConflict: 'code' });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[upsertCommitteeCriterion] supabase error:', error);
  }
}

export async function deleteCommitteeCriterion(id: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.from('committee_criteria').delete().eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[deleteCommitteeCriterion] supabase error:', error);
  }
}
