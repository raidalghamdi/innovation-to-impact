// Dynamic admin settings (R43). Reads/writes innovation.admin_settings, a
// key/jsonb store backing runtime configuration (Top-N, Pass Threshold) so the
// numbers change without a redeploy. Server-only: uses the RLS-scoped server
// client (schema 'innovation'). Degrades to defaults when Supabase is
// unconfigured so builds/previews still render.
import { createClient } from '@/lib/supabase/server';

const DEFAULT_TOP_N = 5;
const DEFAULT_PASS_THRESHOLD = 7;

// Settings are stored as jsonb of the shape { "value": <T> }.
type SettingRow = { key: string; value: { value: unknown } | null };

export async function getAdminSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as SettingRow;
    const inner = row.value?.value;
    return (inner ?? null) as T | null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getAdminSetting] threw:', err);
    return null;
  }
}

export async function setAdminSetting(key: string, value: unknown): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const { error } = await supabase
    .from('admin_settings')
    .upsert(
      { key, value: { value }, updated_by: uid, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[setAdminSetting] supabase error:', error);
  }
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function getTopN(): Promise<number> {
  const value = await getAdminSetting<number>('top_n');
  return toPositiveInt(value, DEFAULT_TOP_N);
}

export async function getPassThreshold(): Promise<number> {
  const value = await getAdminSetting<number>('pass_threshold');
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PASS_THRESHOLD;
}
