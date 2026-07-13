-- R45.4: Expand supervisor read access on user_profiles to include evaluators and judges.
--
-- Root cause: The `profiles_read_supervisor_participants` policy only allowed supervisors to
-- read innovator/submitter profiles. When the supervisor's track-assignment page needed to
-- resolve evaluator names+emails from the IDs returned by v_user_roles, the follow-up
-- SELECT on user_profiles returned 0 rows and the dropdown showed "لا يوجد مقيّمون".
--
-- Fix: rewrite the policy so a supervisor can read profiles of users who hold ANY of
--   innovator, submitter, evaluator, judge  (the roles a supervisor legitimately interacts with).
-- Admins are unaffected (they have their own policies).

BEGIN;

DROP POLICY IF EXISTS profiles_read_supervisor_participants ON innovation.user_profiles;

CREATE POLICY profiles_read_supervisor_participants
  ON innovation.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    innovation.is_supervisor()
    AND (
      -- legacy column path (kept as safety net)
      role = ANY (ARRAY['innovator', 'submitter', 'evaluator', 'judge'])
      OR EXISTS (
        SELECT 1
        FROM innovation.v_user_roles tvur
        WHERE tvur.user_id = user_profiles.id
          AND tvur.role_code = ANY (ARRAY['innovator', 'submitter', 'evaluator', 'judge'])
      )
    )
  );

COMMIT;
