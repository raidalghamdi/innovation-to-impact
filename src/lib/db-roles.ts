import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * DB-backed multi-role helpers (Batch B / migration 00021).
 *
 * These read from `innovation.roles` and `innovation.user_roles`, which are
 * additive to the legacy single-value `user_profiles.role` column used by
 * src/lib/roles.ts. Application code should prefer these when available and
 * fall back to the legacy single-role resolver otherwise (see
 * resolveRoleWithProfile in src/lib/roles.ts) — this keeps existing
 * functionality intact while layering multi-role support on top.
 */

export type DbRole = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
};

export type UserRoleRow = {
  role_id: string;
  role_code: string;
  role_name_ar: string;
  role_name_en: string;
  is_primary: boolean;
  sort_order: number;
};

/** All active roles, ordered for display (role selection screen, import template columns, etc). */
export async function getActiveRoles(): Promise<DbRole[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as DbRole[];
}

/** All roles (including inactive) — used by the admin roles catalog editor. */
export async function getAllRoles(): Promise<DbRole[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as DbRole[];
}

/** Roles assigned to a given user via innovation.user_roles (multi-role). */
export async function getUserRoles(userId: string): Promise<UserRoleRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .schema('innovation').from('v_user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('role_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as UserRoleRow[];
}

/** Reads the current signed-in user's roles using the RLS-scoped server client (safe for use in Server Components). */
export async function getMyUserRoles(): Promise<UserRoleRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .schema('innovation').from('v_user_roles')
    .select('*')
    .eq('user_id', uid)
    .eq('role_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as UserRoleRow[];
}

const VALID_ROLE_CODES = ['innovator', 'judge', 'committee', 'supervisor', 'admin'] as const;
export type RoleCode = (typeof VALID_ROLE_CODES)[number];

export function isValidRoleCode(value: unknown): value is RoleCode {
  return typeof value === 'string' && (VALID_ROLE_CODES as readonly string[]).includes(value);
}

/** Reads a single platform_settings value by key, with a fallback if unset/unreachable. */
export async function getPlatformSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const admin = createAdminClient();
  if (!admin) return fallback;
  const { data, error } = await admin.from('platform_settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return fallback;
  return (data.value as T) ?? fallback;
}

/**
 * src/lib/db-roles.ts — isCurrentUserAdmin()
 * Phase 11.3/11.4 fix — admin gate for the new /admin/users and /admin/roles
 * pages. A user should reach these pages if EITHER the legacy single-value
 * `user_profiles.role === 'admin'` (the pattern every pre-existing admin
 * page under /admin/* already checks — left untouched there) OR they hold
 * the new DB-driven `admin` role via `innovation.user_roles` (Batch B
 * multi-role users who were never migrated to the legacy column). This is
 * additive only: no existing admin page's gating logic is changed.
 */
export async function isCurrentUserAdmin(legacyRole: string | null | undefined): Promise<boolean> {
  if (legacyRole === 'admin') return true;
  const myRoles = await getMyUserRoles();
  return myRoles.some((r) => r.role_code === 'admin');
}
