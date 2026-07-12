-- Round 34: Allow supervisors to read evidence for ideas they oversee.
-- The original policy (migration 00012) covered submitter, evaluator, judge, admin
-- but omitted 'supervisor', so users with role_code='supervisor' via v_user_roles
-- got 0 rows and the UI rendered "لا توجد مرفقات".

DROP POLICY IF EXISTS evidence_idea_stakeholders ON innovation.evidence_attachments;

CREATE POLICY evidence_idea_stakeholders
  ON innovation.evidence_attachments
  FOR SELECT
  USING (
    idea_id IS NOT NULL
    AND (
      -- submitter of the idea
      EXISTS (
        SELECT 1 FROM innovation.ideas i
        WHERE i.id = evidence_attachments.idea_id
          AND i.submitter_id = auth.uid()
      )
      -- assigned evaluator
      OR EXISTS (
        SELECT 1 FROM innovation.assignments a
        WHERE a.idea_id = evidence_attachments.idea_id
          AND a.evaluator_id = auth.uid()
      )
      -- admin / judge via legacy role column
      OR EXISTS (
        SELECT 1 FROM innovation.user_profiles up
        WHERE up.id = auth.uid()
          AND up.role = ANY (ARRAY['judge','admin'])
      )
      -- supervisor / admin / judge / committee via v_user_roles (multi-role model)
      OR EXISTS (
        SELECT 1 FROM innovation.v_user_roles vur
        WHERE vur.user_id = auth.uid()
          AND vur.role_code = ANY (ARRAY['supervisor','admin','judge','committee'])
      )
    )
  );
