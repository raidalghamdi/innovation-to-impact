export const ROLES = ['submitter', 'evaluator', 'judge', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Landing dashboard per role after login.
export const ROLE_HOME: Record<Role, string> = {
  submitter: '/my-ideas',
  evaluator: '/evaluation',
  judge: '/committee',
  admin: '/admin',
};

// Route prefixes each role is NOT allowed to access (locale prefix stripped).
export const ROLE_DENY: Record<Role, string[]> = {
  submitter: ['/evaluation', '/committee', '/admin', '/analytics'],
  evaluator: ['/committee', '/admin', '/analytics'],
  judge: ['/admin', '/analytics'],
  admin: [],
};

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
