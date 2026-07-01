import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/roles';
import { isRole, roleFromEmail } from '@/lib/roles';

export { roleFromEmail };

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
} | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Prefer an explicit role from user_metadata, then profiles table, then email.
  let role: Role | undefined = isRole(user.user_metadata?.role)
    ? (user.user_metadata!.role as Role)
    : undefined;

  if (!role) {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (data && isRole(data.role)) role = data.role as Role;
    } catch {
      // user_profiles table not available yet — fall back to email heuristic.
    }
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: role ?? roleFromEmail(user.email),
    fullName: (user.user_metadata?.full_name as string) ?? null,
  };
}
