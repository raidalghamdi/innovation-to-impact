-- R42-later Item 10 — supervisors see ALL ideas (no per-supervisor assignment).
--
-- The /admin/all-ideas page lets any user with the `supervisor` role review
-- every idea across all tracks. The server client uses the anon key + the
-- user's cookies, so RLS applies. This adds an additive SELECT policy granting
-- supervisor / admin / committee roles read access to all ideas.
--
-- Role detection mirrors migration 00024 (evidence supervisor read):
--   - innovation.v_user_roles.role_code for the multi-role model
--   - innovation.user_profiles.role for the legacy single-role column
--
-- RLS policies are OR-combined, so this does not narrow any existing policy
-- (submitter can still read their own ideas, admin_all still applies, etc.).

DROP POLICY IF EXISTS ideas_select_supervisor ON innovation.ideas;

CREATE POLICY ideas_select_supervisor
  ON innovation.ideas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM innovation.v_user_roles vur
      WHERE vur.user_id = auth.uid()
        AND vur.role_code = ANY (ARRAY['supervisor', 'admin', 'committee'])
    )
    OR EXISTS (
      SELECT 1 FROM innovation.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = ANY (ARRAY['supervisor', 'admin'])
    )
  );
