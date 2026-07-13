-- 00037_post_pass_attachments.sql
-- R43 Automation (Agent B) — distinguish post-pass (T2) attachments.
--
-- After an idea passes evaluation (status = pass_awaiting_attachments) the
-- innovator must upload mandatory supporting attachments before it can advance
-- to the committee. To tell those apart from the original submission evidence
-- we tag each row with an attachment_type.
--
-- Attachments live in innovation.evidence_attachments (the live attachments
-- table; there is no idea_attachments / evaluation_evidence table). Existing
-- rows are backfilled to 'initial'.
--
-- Idempotent: add column if not exists + guarded backfill + create index if
-- not exists. Safe to re-run.

alter table innovation.evidence_attachments
  add column if not exists attachment_type text not null default 'initial'
    check (attachment_type in ('initial', 'post_pass'));

-- Backfill any pre-existing rows (the default already covers them, but this is
-- explicit and safe on re-run).
update innovation.evidence_attachments
   set attachment_type = 'initial'
 where attachment_type is null;

-- Partial index for the T2 gate: "does this idea have >= 1 live post_pass
-- attachment?" and general lookups by (idea, type).
create index if not exists idx_evidence_idea_type
  on innovation.evidence_attachments (idea_id, attachment_type)
  where deleted_at is null;

-- Verification (run after applying):
--   SELECT attachment_type, count(*) FROM innovation.evidence_attachments
--     GROUP BY attachment_type;
