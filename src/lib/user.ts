import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/roles';
import { resolveRoleWithProfile, roleFromEmail } from '@/lib/roles';

export { roleFromEmail };

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  isFirstSession: boolean;
} | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Canonical role resolution: user_profiles → user_metadata → email.
  // See src/lib/roles.ts resolveRoleWithProfile for rationale.
  let profileRole: unknown = undefined;
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle();
    profileRole = data?.role;
  } catch {
    // user_profiles unreachable — fall through to metadata/email.
  }

  // First-time vs returning: Supabase sets last_sign_in_at ~= created_at on
  // the very first sign-in. Compare with a small tolerance for clock skew.
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  const isFirstSession = Math.abs(lastSignInAt - createdAt) < 60_000;

  return {
    id: user.id,
    email: user.email ?? null,
    role: resolveRoleWithProfile({
      profileRole,
      metadataRole: user.user_metadata?.role,
      email: user.email,
    }),
    fullName: (user.user_metadata?.full_name as string) ?? null,
    isFirstSession,
  };
}
