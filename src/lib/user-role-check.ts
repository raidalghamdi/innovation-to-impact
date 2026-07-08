import { createClient } from '@/lib/supabase/server';

/**
 * Checks whether the given user_id has the given role code in innovation.user_roles.
 * Uses the roles-join view so we match by role.code, not the raw uuid.
 * Returns false for missing user, missing role, or DB errors.
 */
export async function userHasRole(userId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id, roles!inner(code)')
    .eq('user_id', userId);
  if (error || !data) return false;
  // Supabase types the joined row as an array (roles: {code}[]) even though
  // roles!inner returns a single object. Normalize by taking the first item.
  const rows = data as unknown as Array<{ roles: { code: string } | { code: string }[] | null }>;
  return rows.some((r) => {
    const rel = r.roles;
    if (!rel) return false;
    if (Array.isArray(rel)) return rel.some((rr) => rr?.code === code);
    return rel.code === code;
  });
}

export async function isCurrentUserSupervisor(userId: string): Promise<boolean> {
  return userHasRole(userId, 'supervisor');
}

export async function isCurrentUserJudge(userId: string): Promise<boolean> {
  // Both `judge` and `committee` count as judges in the workflow.
  return (await userHasRole(userId, 'judge')) || (await userHasRole(userId, 'committee'));
}
