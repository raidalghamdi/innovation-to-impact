-- 00027_ideas_returned_flag.sql
-- R42-later Item 6 (Innovator dashboard): status/workflow sync.
--
-- Adds a dedicated `returned_to_innovator` boolean to innovation.ideas so the
-- supervisor "معادة / returned" surfaces and the innovator timeline can be
-- driven by an explicit flag instead of overloading the idea_status enum.
--
-- Why a flag and not a new enum value:
--   * `idea_status` already carries a 'returned' value, but several innovator
--     and supervisor views need to distinguish "returned, awaiting the
--     innovator's edits" from other transient states without a schema-wide
--     enum change that would ripple into Agents 2/3/4's read paths.
--   * A boolean is additive and backward-compatible: existing code that reads
--     `status` keeps working; new code reads the flag.
--
-- Write paths that maintain this flag (this PR):
--   * supervisor decision route: return  → true, approve/reject → false
--   * innovator resubmit route:  resubmit → false
--
-- Idempotent: safe to re-run.

alter table innovation.ideas
  add column if not exists returned_to_innovator boolean not null default false;

-- Backfill: any idea currently sitting in the 'returned' status is, by
-- definition, awaiting the innovator — mark the flag so pre-existing rows show
-- up on the new "معادة" surfaces immediately.
update innovation.ideas
  set returned_to_innovator = true
  where status = 'returned'
    and returned_to_innovator is distinct from true;

-- Verification query (run after applying):
--   SELECT returned_to_innovator, count(*)
--   FROM innovation.ideas GROUP BY 1;
