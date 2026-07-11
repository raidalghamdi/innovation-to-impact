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

  // Canonical role resolution:
  //   1. innovation.user_roles (source of truth — supports multi-role users)
  //   2. user_profiles.role (legacy single-role column, often stale/"member")
  //   3. user_metadata.role (JWT-embedded fallback)
  //   4. roleFromEmail (demo-only)
  //
  // Priority order for user_roles picks the highest privilege that maps to a
  // Role enum value (admin > judge > evaluator > submitter). This ensures a
  // supervisor/judge/evaluator with role='member' in user_profiles is not
  // silently demoted to 'submitter'.
  let derivedRole: unknown = undefined;
  try {
    const { data: roleRows } = await supabase
      .from('v_user_roles')
      .select('role_code, role_active')
      .eq('user_id', user.id);
    const codes = new Set(
      ((roleRows as { role_code?: string; role_active?: boolean }[]) ?? [])
        .filter((r) => r.role_active !== false)
        .map((r) => (r.role_code ?? '').toLowerCase())
    );
    // Map DB role codes to the app's Role enum. Supervisor is treated as
    // 'admin'-level for landing/navigation purposes (they have supervisor UI),
    // committee acts like a judge. Note: the client-side AppShell separately
    // reads the i2i_active_role cookie and downgrades to the canonical
    // 'supervisor' role there — so the supervisor's own dropdown/nav renders
    // as supervisor (dropdown "لوحة أعمالي" points at /supervisor, not
    // /admin) while server-side /admin/* access is still allowed for them.
    if (codes.has('admin')) derivedRole = 'admin';
    else if (codes.has('supervisor')) derivedRole = 'admin';
    else if (codes.has('judge') || codes.has('committee')) derivedRole = 'judge';
    else if (codes.has('evaluator')) derivedRole = 'evaluator';
    else if (codes.has('innovator') || codes.has('submitter')) derivedRole = 'submitter';
  } catch {
    // v_user_roles unreachable — fall through.
  }

  let profileRole: unknown = undefined;
  if (!derivedRole) {
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
      profileRole: derivedRole ?? profileRole,
      metadataRole: user.user_metadata?.role,
      email: user.email,
    }),
    fullName: (user.user_metadata?.full_name as string) ?? null,
    isFirstSession,
  };
}
