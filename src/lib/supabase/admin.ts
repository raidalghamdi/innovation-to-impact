import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for privileged, session-less server jobs (cron
 * reminders, notification fan-out) that must read/write across users and so
 * cannot rely on the RLS-scoped anon client.
 *
 * SERVER-ONLY. Never import this into a client component — it bypasses RLS.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is unset so builds/previews and
 * local runs without the key degrade gracefully instead of throwing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    db: { schema: 'innovation' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
