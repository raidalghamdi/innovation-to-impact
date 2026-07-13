-- R45.7: allow context='post_pass' in evidence_attachments.
--
-- Root cause: the finalize page (post-evaluation supervisor/innovator upload)
-- inserts evidence rows with context='post_pass', but the CHECK constraint
-- only permitted ('idea_submission','evaluation','committee','compliance',
-- 'implementation'). Every upload from that screen failed with
--   new row for relation "evidence_attachments" violates check constraint
--   "evidence_attachments_context_check"
--
-- Fix: add 'post_pass' to the accepted values.

ALTER TABLE innovation.evidence_attachments
  DROP CONSTRAINT IF EXISTS evidence_attachments_context_check;

ALTER TABLE innovation.evidence_attachments
  ADD CONSTRAINT evidence_attachments_context_check
  CHECK (context = ANY (ARRAY[
    'idea_submission',
    'evaluation',
    'post_pass',
    'committee',
    'compliance',
    'implementation'
  ]));
