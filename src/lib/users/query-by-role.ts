import { createClient } from '@/lib/supabase/server';

// Live, DB-only source for user pickers/dropdowns. Reads the canonical
// multi-role model (innovation.v_user_roles) joined to innovation.user_profiles.
// There is deliberately NO seed/demo fallback here: dropdowns of users must
// reflect the real directory, never a hardcoded list. Returns [] when Supabase
// is unconfigured (build/preview) so pages still render an empty picker.
//
// Schema note: user_profiles exposes `full_name` (default/English) and
// `full_name_ar`; there is no `full_name_en` or `is_active` column (account
// active state lives in auth.users.banned_until), so those are intentionally
// omitted from the returned shape.

export type UserByRole = {
  id: string;
  email: string | null;
  full_name: string | null;
  full_name_ar: string | null;
  role_code: string;
};

export async function getUsersByRole(roleCode: string): Promise<UserByRole[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  // 1. Resolve the user ids that currently hold this role.
  const { data: roleRows, error: roleErr } = await supabase
    .from('v_user_roles')
    .select('user_id, role_code')
    .eq('role_code', roleCode)
    .eq('role_active', true);
  if (roleErr) throw roleErr;

  const ids = Array.from(
    new Set((roleRows ?? []).map((r) => (r as { user_id: string }).user_id))
  );
  if (!ids.length) return [];

  // 2. Fetch their profile fields. Two-step (rather than a PostgREST embed)
  //    because v_user_roles is a view without an auto-detected FK to profiles.
  const { data: profs, error: profErr } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, full_name_ar')
    .in('id', ids);
  if (profErr) throw profErr;

  return ((profs ?? []) as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    full_name_ar: string | null;
  }>)
    .map((p) => ({
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      full_name_ar: p.full_name_ar ?? null,
      role_code: roleCode,
    }))
    .sort((a, b) =>
      (a.full_name_ar || a.full_name || a.email || '').localeCompare(
        b.full_name_ar || b.full_name || b.email || ''
      )
    );
}
