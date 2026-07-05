-- Migration 00023: Email Outbox
-- Purpose: durable, env-driven outbound email queue.
-- Rows are inserted whenever a notification requires email delivery.
-- A separate worker (or on-demand /api/email/flush endpoint) sends when SMTP is configured;
-- when SMTP is NOT configured the row stays in status='pending' and no send is attempted.
-- This is safe by default — no throws, no dropped notifications.

SET search_path = innovation, public;

CREATE TABLE IF NOT EXISTS innovation.email_outbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email     text NOT NULL,
  to_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject      text NOT NULL,
  body_html    text,
  body_text    text,
  category     text NOT NULL DEFAULT 'notification',
                -- e.g. 'team_invite', 'idea_status', 'evaluation_ready', 'notification'
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','sending','sent','failed','skipped')),
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_sched
  ON innovation.email_outbox(status, scheduled_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_email_outbox_user
  ON innovation.email_outbox(to_user_id);

-- RLS: only service role (or admins) can access
ALTER TABLE innovation.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_outbox_admin_select ON innovation.email_outbox;
CREATE POLICY email_outbox_admin_select ON innovation.email_outbox
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM innovation.user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Inserts are done via SECURITY DEFINER helper OR service role — no direct policy needed.
-- (No INSERT/UPDATE policy => only service role and SECURITY DEFINER functions can write.)

-- Helper: enqueue an email
CREATE OR REPLACE FUNCTION innovation.fn_enqueue_email(
  p_to_email  text,
  p_subject   text,
  p_body_html text,
  p_body_text text DEFAULT NULL,
  p_category  text DEFAULT 'notification',
  p_to_user_id uuid DEFAULT NULL,
  p_metadata  jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = innovation, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO innovation.email_outbox
    (to_email, to_user_id, subject, body_html, body_text, category, metadata)
  VALUES
    (p_to_email, p_to_user_id, p_subject, p_body_html, p_body_text, p_category, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION innovation.fn_enqueue_email(text,text,text,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION innovation.fn_enqueue_email(text,text,text,text,text,uuid,jsonb) TO authenticated;
