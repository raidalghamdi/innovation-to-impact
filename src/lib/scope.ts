// Scope-key RBAC for analytics. A Scope narrows what a signed-in user may see:
// admins see everything; non-admins are constrained to their department and/or
// their assigned strategic themes (resolved from user_profiles — see migration
// 00011 for the added columns).
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import type { Role } from '@/lib/roles';

export type Scope = {
  role: Role;
  userId: string;
  allowedDepartments?: string[];
  allowedThemes?: string[];
};

// Anonymous / unconfigured fallback: a submitter scope with no access, so
// analytics surfaces render empty rather than throwing.
const ANON_SCOPE: Scope = { role: 'submitter', userId: '' };

/**
 * Resolve the current user's analytics scope from their session + profile.
 * Admins get an unconstrained scope. Everyone else is limited to their own
 * department and their `allowed_themes` list. Best-effort: never throws.
 */
export async function getScope(): Promise<Scope> {
  const user = await getCurrentUser();
  if (!user) return ANON_SCOPE;
  if (user.role === 'admin') return { role: 'admin', userId: user.id };

  const supabase = await createClient();
  if (!supabase) return { role: user.role, userId: user.id };

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('department, allowed_themes')
      .eq('id', user.id)
      .maybeSingle();
    const row = data as { department?: string | null; allowed_themes?: string[] | null } | null;
    return {
      role: user.role,
      userId: user.id,
      allowedDepartments: row?.department ? [row.department] : [],
      allowedThemes: row?.allowed_themes ?? [],
    };
  } catch {
    return { role: user.role, userId: user.id };
  }
}

// True when a scope is unconstrained (admin) and should bypass all narrowing.
export function isFullScope(scope: Scope): boolean {
  return scope.role === 'admin';
}

// Whether a scope may see a given strategic theme. Admins see all; others only
// their assigned themes. An empty allowed list means "no theme access".
export function scopeAllowsTheme(scope: Scope, themeId: string): boolean {
  if (isFullScope(scope)) return true;
  return (scope.allowedThemes ?? []).includes(themeId);
}

// Minimal shape of the part of a PostgREST query builder we chain onto.
type Filterable<Q> = { in(column: string, values: readonly string[]): Q };

/**
 * Append a department filter to a query when the scope is narrower than admin.
 * `table` names the table being queried (for callers that keep per-table
 * column maps); only tables carrying a `department` column are narrowed here.
 */
export function applyScopeToQuery<Q extends Filterable<Q>>(
  query: Q,
  scope: Scope,
  table: string
): Q {
  if (isFullScope(scope)) return query;
  const depts = scope.allowedDepartments ?? [];
  const DEPARTMENT_SCOPED = new Set(['user_profiles', 'assignments']);
  if (depts.length > 0 && DEPARTMENT_SCOPED.has(table)) {
    return query.in('department', depts);
  }
  return query;
}
