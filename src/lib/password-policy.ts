// src/lib/password-policy.ts
// Password strength policy — aligned with NIST 800-63B / SAMA guidance for
// government platforms. Enforced on:
//   • self-registration (POST /api/auth/register)
//   • first-time activation (POST /api/auth/activate)
//   • password reset (POST /api/auth/reset-password)
//
// Client-side callers should also use `validatePassword()` for a live UX,
// but the server is the source of truth.

export type PolicyIssue =
  | 'too_short'
  | 'no_uppercase'
  | 'no_lowercase'
  | 'no_digit'
  | 'no_symbol';

export const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
} as const;

// A liberal symbol class: anything that isn't a letter, digit, or whitespace.
// Matches the OWASP/NIST recommendation of "allow all printable characters".
const SYMBOL_RE = /[^A-Za-z0-9\s]/;

export function validatePassword(pw: string): { ok: boolean; issues: PolicyIssue[] } {
  const issues: PolicyIssue[] = [];
  if (!pw || pw.length < PASSWORD_POLICY.minLength) issues.push('too_short');
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(pw)) issues.push('no_uppercase');
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(pw)) issues.push('no_lowercase');
  if (PASSWORD_POLICY.requireDigit && !/\d/.test(pw)) issues.push('no_digit');
  if (PASSWORD_POLICY.requireSymbol && !SYMBOL_RE.test(pw)) issues.push('no_symbol');
  return { ok: issues.length === 0, issues };
}
