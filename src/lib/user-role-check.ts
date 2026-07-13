import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/user-roles';

/**
 * Checks whether the given user_id actively holds the given role code.
 * Reads the single source of truth via innovation.v_user_roles (the only role
 * read path) — this is also RLS-safe for callers checking another user.
 * Returns false for missing user, missing role, or DB errors.
 */
export async function userHasRole(userId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  return hasRole(supabase, userId, code);
}

export async function isCurrentUserSupervisor(userId: string): Promise<boolean> {
  return userHasRole(userId, 'supervisor');
}

export async function isCurrentUserJudge(userId: string): Promise<boolean> {
  // Both `judge` and `committee` count as judges in the workflow.
  return (await userHasRole(userId, 'judge')) || (await userHasRole(userId, 'committee'));
}
