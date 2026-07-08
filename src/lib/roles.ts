export const ROLES = ['submitter', 'evaluator', 'judge', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Landing dashboard per role after login.
export const ROLE_HOME: Record<Role, string> = {
  submitter: '/dashboard',
  evaluator: '/evaluation',
  judge: '/committee',
  admin: '/admin',
};

// Resolve the correct landing route from a DB role_code that may use aliases
// returned by innovation.v_user_roles (innovator, committee, supervisor) as
// well as the canonical Role enum values. Falls back to /my-ideas.
export function homeForRoleCode(roleCode: string | null | undefined): string {
  const key = (roleCode ?? '').toLowerCase();
  if (key === 'admin') return '/admin';
  if (key === 'judge' || key === 'committee') return '/committee';
  if (key === 'supervisor') return '/supervisor';
  if (key === 'evaluator') return '/evaluation';
  if (key === 'submitter' || key === 'innovator') return '/dashboard';
  return '/dashboard';
}

// Route prefixes each role is NOT allowed to access (locale prefix stripped).
// Note: /admin/analytics is intentionally allowed for both admin and judge
// — see analytics page role check. /admin (non-analytics) remains admin-only.
export const ROLE_DENY: Record<Role, string[]> = {
  submitter: ['/evaluation', '/committee', '/admin', '/analytics'],
  evaluator: ['/committee', '/admin', '/analytics'],
  judge: ['/admin', '/analytics'],
  admin: [],
};

// Roles allowed to view the analytics dashboard (finer-grained than ROLE_DENY,
// which is used by middleware for whole-prefix denial). Judges can see analytics
// but are still denied the rest of /admin.
export const ANALYTICS_ROLES: readonly Role[] = ['admin', 'judge'];

export function canAccess(role: Role, pathnameWithoutLocale: string): boolean {
  return !ROLE_DENY[role].some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(`${p}/`)
  );
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// Demo-only: derive a role from the email local-part (admin@..., judge@...,
// etc.). Never runs in production — gated by DEMO_MODE=true. When disabled,
// every unmapped email is treated as a plain 'submitter' so the UI stays
// functional but never grants elevated access via email guessing.
const isDemoMode = process.env.DEMO_MODE === 'true';

export function roleFromEmail(email?: string | null): Role {
  if (!isDemoMode) return 'submitter';
  if (!email) return 'submitter';
  const local = email.split('@')[0].toLowerCase();
  if (local.startsWith('admin')) return 'admin';
  if (local.startsWith('judge')) return 'judge';
  if (local.startsWith('evaluator')) return 'evaluator';
  return 'submitter';
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical role resolution
// ─────────────────────────────────────────────────────────────────────────────
// Two helpers, one priority order. Use the one that matches the data you have:
//
//   resolveRoleWithProfile — server contexts that can query user_profiles.
//     Priority: user_profiles.role → user_metadata.role → roleFromEmail(email).
//     user_profiles is the canonical RBAC storage; metadata is a JWT-embedded
//     cache that can drift; email is a demo fallback.
//
//   resolveRoleSync — edge/middleware and client components that only have
//     the JWT (no DB access per request). Priority: user_metadata.role →
//     roleFromEmail(email). Same intent as above but skips the profile step.
//
// Keep these in sync. If you add a new source of truth (e.g. app_metadata),
// change both.

type MinimalUser = {
  email?: string | null;
  user_metadata?: { role?: unknown } | null;
} | null | undefined;

export function resolveRoleWithProfile(input: {
  profileRole?: unknown;
  metadataRole?: unknown;
  email?: string | null;
}): Role {
  if (isRole(input.profileRole)) return input.profileRole;
  if (isRole(input.metadataRole)) return input.metadataRole;
  return roleFromEmail(input.email);
}

export function resolveRoleSync(user: MinimalUser): Role {
  const metadataRole = user?.user_metadata?.role;
  if (isRole(metadataRole)) return metadataRole;
  return roleFromEmail(user?.email ?? null);
}
