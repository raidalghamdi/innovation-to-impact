import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/roles';
import { resolveRoleWithProfile, roleFromEmail } from '@/lib/roles';

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

  return {
    id: user.id,
    email: user.email ?? null,
    role: resolveRoleWithProfile({
      profileRole,
      metadataRole: user.user_metadata?.role,
      email: user.email,
    }),
    fullName: (user.user_metadata?.full_name as string) ?? null,
  };
}
