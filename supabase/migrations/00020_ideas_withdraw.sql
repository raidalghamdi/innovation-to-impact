-- 00020_ideas_withdraw.sql
-- Add the 'withdrawn' idea_status enum value so submitters can voluntarily
-- withdraw an idea before it enters formal evaluation.
--
-- Scope decided in the P2 audit: soft-delete via status change, submitter
-- only, allowed while current_stage <= 2 (draft / submitted / screening),
-- admin-reversible. Assigned evaluators get an in-app notification via the
-- server action. History is preserved via the audit log.
--
-- Postgres constraint: ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block. Supabase's SQL editor auto-wraps statements, so this
-- migration is intentionally a single ALTER TYPE. The status-change RLS +
-- audit trigger flow already covers the write path — no new policy needed
-- because the submitter-owns-idea SELECT/UPDATE policies from 00001 already
-- gate the status update.

alter type innovation.idea_status add value if not exists 'withdrawn';

-- Verification query (run after applying):
--   SELECT enumlabel FROM pg_enum
--   WHERE enumtypid = 'innovation.idea_status'::regtype
--   ORDER BY enumsortorder;
-- Expected: original 15 values + 'withdrawn' at the end.
