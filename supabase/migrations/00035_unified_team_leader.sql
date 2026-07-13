-- 00035_unified_team_leader.sql
-- R42-later Item 7 — single source of truth for "قائد الفريق / Team Leader".
--
-- The canonical leader field innovation.ideas.team_leader_id was added in
-- 00028_team_leader_and_min (backfilled to the submitter for team ideas). This
-- migration exposes a view that resolves the effective leader for EVERY idea
-- (team or individual) by falling back to the submitter, and joins the leader's
-- email + display name so dashboards never re-derive this logic.
--
-- Consumers (per Item 7 clarification): innovator, supervisor and admin
-- dashboards read this view. The evaluator dashboard does NOT (evaluators must
-- not see team/leader identity). src/lib/team-leader.ts is the only code path.
--
-- Idempotent: create-or-replace view + re-grant. Safe to re-run.

create or replace view innovation.v_team_leader as
select
  i.id as idea_id,
  coalesce(i.team_leader_id, i.submitter_id) as leader_id,
  au.email as leader_email,
  coalesce(up.full_name, au.raw_user_meta_data->>'name', au.email) as leader_name
from innovation.ideas i
left join auth.users au on au.id = coalesce(i.team_leader_id, i.submitter_id)
left join innovation.user_profiles up on up.id = coalesce(i.team_leader_id, i.submitter_id);

grant select on innovation.v_team_leader to authenticated, anon;

-- Verification (run after applying):
--   SELECT idea_id, leader_id, leader_email, leader_name
--     FROM innovation.v_team_leader LIMIT 5;
