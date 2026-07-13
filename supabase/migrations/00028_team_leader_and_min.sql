-- 00028_team_leader_and_min.sql
-- R42-later Items 4 & 7 (Innovator dashboard): team leader + team minimum size.
--
-- Item 7 — Team leader is the account owner (submitter):
--   Canonical leader field is `innovation.ideas.team_leader_id`. For any team
--   idea, the leader is the submitter (the account that created the idea). This
--   column is the source of truth other agents should read for "قائد الفريق /
--   Team Leader". Documented in /home/user/workspace/r42_later_agent1_leader_field.md
--   so Agent 2 (supervisor views) can consume it.
--
--   The submission form stores *additional* members in the `ideas.team_members`
--   JSONB array (leader excluded from that array), so the effective team size is
--   1 (leader) + jsonb_array_length(team_members).
--
-- Item 4 — Team minimum size is 3 (leader + at least 2 additional members):
--   Enforced in the app (idea-form.tsx first submission, resubmit route,
--   participation-type switch). We also add a DB CHECK as defense in depth,
--   added NOT VALID so pre-existing rows that predate the rule are not
--   retroactively rejected — only new/updated rows are validated.
--
-- Idempotent where possible; safe to re-run.

-- 1) Leader column.
-- FK target matches innovation.teams.leader_id (00022) → auth.users(id).
alter table innovation.ideas
  add column if not exists team_leader_id uuid references auth.users(id) on delete set null;

-- 2) Retroactive backfill: for every team idea, the leader is the submitter.
--    (participation_type is a live column on innovation.ideas.)
update innovation.ideas
  set team_leader_id = submitter_id
  where participation_type = 'team'
    and submitter_id is not null
    and team_leader_id is distinct from submitter_id;

-- 3) Team minimum-size CHECK (defense in depth; app is primary enforcement).
--    A team idea must carry >= 2 additional members in the JSONB array
--    (leader + 2 = 3 total). Individual ideas are unconstrained.
--    NOT VALID: applies to new/updated rows only, leaving legacy rows intact.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideas_team_min_members'
      and conrelid = 'innovation.ideas'::regclass
  ) then
    alter table innovation.ideas
      add constraint ideas_team_min_members
      check (
        participation_type is distinct from 'team'
        or coalesce(jsonb_array_length(team_members), 0) >= 2
      ) not valid;
  end if;
end $$;

-- Verification queries (run after applying):
--   SELECT count(*) FROM innovation.ideas
--   WHERE participation_type = 'team' AND team_leader_id IS NULL;   -- expect 0
--   SELECT conname, convalidated FROM pg_constraint
--   WHERE conname = 'ideas_team_min_members';
