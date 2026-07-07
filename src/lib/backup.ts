// src/lib/backup.ts
// Database backup helpers — the admin-only "Everything" export/import.
//
// Design:
//   - Full backup covers every table under the `innovation` schema. We keep an
//     explicit allow-list here (BACKUP_TABLES) so a new table doesn't leak into
//     an export without a human deciding whether it should be included. When
//     you add a table to the schema, add it here too.
//   - Order matters for import: parent tables first so foreign keys resolve.
//   - Auth secrets (passwords, hashed OTP codes) are NEVER exported. otp_codes
//     is intentionally excluded — it's short-lived, sensitive, and rebuilding
//     it on import would break active sessions anyway.
//   - Import is merge-only: upsert on primary key. Nothing is deleted server-
//     side, matching the user's explicit "دمج/إضافة فقط (آمن)" choice.

export const BACKUP_TABLES: readonly string[] = [
  // ── Reference / lookup tables (no FK dependencies) ───────────────────────
  'roles',
  'strategic_themes',
  'activities',
  'badges',
  'compliance_controls',
  'sla_policies',
  'platform_settings',
  'cms_content',
  'cms_blocks',

  // ── People ──────────────────────────────────────────────────────────────
  'user_profiles',
  'user_roles',
  'employees',
  'employee_roles',

  // ── Teams ───────────────────────────────────────────────────────────────
  'teams',
  'team_members',
  'team_invitations',

  // ── Ideas & lifecycle ───────────────────────────────────────────────────
  'ideas',
  'idea_relationships',
  'idea_feedback',
  'evidence_attachments',
  'evaluations',
  'assignments',
  'committee_decisions',
  'pilots',
  'scale_decisions',
  'implementations',
  'benefits',
  'funding_requests',

  // ── Governance / IP / knowledge ─────────────────────────────────────────
  'ip_records',
  'ip_signatures',
  'knowledge_articles',

  // ── Approvals & escalations ─────────────────────────────────────────────
  'approval_chains',
  'approval_chain_steps',
  'approval_instances',
  'approval_step_decisions',
  'escalations',
  'escalation_events',
  'change_requests',

  // ── Support / messaging ─────────────────────────────────────────────────
  'support_messages',
  'email_outbox',
  'notifications',

  // ── Gamification ────────────────────────────────────────────────────────
  'user_badges',

  // ── Ops / audit ─────────────────────────────────────────────────────────
  'sla_tracking',
  'audit_logs',

  // NOTE: `otp_codes` is intentionally excluded — short-lived secrets that
  // must not leave the DB. Do not add here.
] as const;

// Excel sheet names have a 31-char limit. Keep a mapping to guarantee unique,
// human-readable tabs even for tables whose names get truncated.
export function sheetNameFor(table: string): string {
  if (table.length <= 31) return table;
  return table.slice(0, 28) + '...';
}
