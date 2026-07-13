-- Migration 00026: Email Log
-- Purpose: audit table for every outbound send attempt recorded by lib/mailer.ts
-- (logEmailAttempt). This table was referenced by the mailer and the
-- /admin/email-log viewer but was never created by a migration, so every insert
-- threw ("relation innovation.email_log does not exist") and was swallowed by the
-- best-effort try/catch — leaving 0 rows despite invitations being marked 'sent'.

SET search_path = innovation, public;

CREATE TABLE IF NOT EXISTS innovation.email_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_original         text,
  to_final            text,
  from_addr           text,
  subject             text,
  provider            text,
  status              text,
  provider_message_id text,
  error               text,
  redirect_applied    boolean NOT NULL DEFAULT false,
  related_entity_type text,
  related_entity_id   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at
  ON innovation.email_log(created_at DESC);

-- RLS: admins may read; writes come only from the service role (mailer), which
-- bypasses RLS. No INSERT policy => no non-service writes.
ALTER TABLE innovation.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_log_admin_select ON innovation.email_log;
CREATE POLICY email_log_admin_select ON innovation.email_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM innovation.user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
