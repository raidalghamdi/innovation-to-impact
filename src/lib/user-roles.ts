import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Canonical READ helpers for user roles (R45).
 *
 * Source of truth = innovation.user_roles (M2M); the only read path is the
 * innovation.v_user_roles view. These helpers take an already-constructed
 * Supabase client (RLS-scoped server client OR service-role admin client) so
 * the caller controls the security context. Every read explicitly chains
 * `.schema('innovation')` so the innovation schema resolves reliably.
 *
 * Do NOT read innovation.user_profiles.role — it is a deprecated legacy column
 * kept only for backward safety (see docs/roles-source-of-truth.md).
 */

type Client = SupabaseClient<any, any, any>;

/** Active role codes held by a user. Empty on error / unconfigured client. */
export async function getUserRoles(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .schema('innovation').from('v_user_roles')
    .select('role_code, role_active')
    .eq('user_id', userId)
    .eq('role_active', true);
  if (error || !data) return [];
  return (data as { role_code: string }[]).map((r) => r.role_code);
}

/** Whether a user actively holds a given role code. */
export async function hasRole(supabase: Client, userId: string, roleCode: string): Promise<boolean> {
  const roles = await getUserRoles(supabase, userId);
  return roles.includes(roleCode);
}

/** Distinct user_ids that actively hold any of the given role code(s). */
export async function listUserIdsByRole(
  supabase: Client,
  roleCodes: string | string[]
): Promise<string[]> {
  const codes = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
  const { data, error } = await supabase
    .schema('innovation').from('v_user_roles')
    .select('user_id')
    .in('role_code', codes)
    .eq('role_active', true);
  if (error || !data) return [];
  return Array.from(new Set((data as { user_id: string }[]).map((r) => r.user_id)));
}
