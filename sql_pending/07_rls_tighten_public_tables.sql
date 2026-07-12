-- 07_rls_tighten_public_tables.sql  (P2 — tighten authenticated-read policies)
--
-- Problem
-- -------
-- 00001_initial_schema.sql created a batch of blanket read policies of the form
--   create policy "read_auth_<t>" on <t> for select to authenticated using (true);
-- Any signed-in user could therefore SELECT every row of internal / personal
-- tables. This migration replaces those blanket policies with scoped ones.
--
-- Fix (per table class)
-- ---------------------
--   activities, media_assets, knowledge_articles, badges
--       -> intentionally left public-read (these are content tables). NO CHANGE.
--          Flagged below for a column-scoping review via views if PII risk.
--   benefits, ip_records, pilots, implementations, funding_requests (internal)
--       -> read only for admin OR supervisor.
--   user_badges (personal)
--       -> read only for the owning user OR admin.
--   teams, team_members (team-scoped)
--       -> read for team members OR admin (leader is auto-added as a member,
--          so leader access is preserved).
--
-- Notes
-- -----
-- * Real schema is `innovation` (not `public`) and the live role model is
--   multi-role via innovation.v_user_roles(user_id, role_code) plus the legacy
--   innovation.user_profiles.role column — matching 00018/00019/00024 and
--   sql_pending/01. `innovation.is_admin()` already exists; this migration adds
--   a matching `innovation.is_supervisor()` helper.
-- * Every table is guarded with to_regclass() so the migration is a safe no-op
--   for any table that does not exist in this database (e.g. badges/user_badges/
--   media_assets are not present in every environment).
--
-- Rollback: drop the new policies and recreate the original
--   `read_auth_<t>` policies with `using (true)`, and (for teams/team_members)
--   the 00022 `teams_select` / `team_members_select` policies.

set search_path = innovation, public;

-- ---------------------------------------------------------------------------
-- 0. Supervisor helper — mirrors the dual (multi-role + legacy) resolution
--    used everywhere else in the codebase. security definer + stable so it can
--    be used inside RLS quals without recursive RLS evaluation.
-- ---------------------------------------------------------------------------
create or replace function innovation.is_supervisor()
returns boolean as $$
  select exists (
    select 1 from innovation.user_profiles up
    where up.id = auth.uid() and up.role = 'supervisor'
  )
  or exists (
    select 1 from innovation.v_user_roles vur
    where vur.user_id = auth.uid() and vur.role_code = 'supervisor'
  );
$$ language sql security definer stable;

grant execute on function innovation.is_supervisor() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Drop the blanket `read_auth_*` policies on the 8 target tables (whatever
--    exact casing/quoting they were created with) wherever they still exist.
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
    where schemaname = 'innovation'
      and tablename in (
        'benefits','ip_records','pilots','implementations','funding_requests',
        'user_badges','teams','team_members'
      )
      and policyname like 'read_auth_%'
  loop
    execute format('drop policy if exists %I on innovation.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Internal data tables -> admin OR supervisor read.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'benefits','ip_records','pilots','implementations','funding_requests'
  ] loop
    if to_regclass(format('innovation.%I', t)) is not null then
      execute format('drop policy if exists %I on innovation.%I', t || '_read_admin_supervisor', t);
      execute format(
        'create policy %I on innovation.%I for select to authenticated '
        || 'using (innovation.is_admin() or innovation.is_supervisor())',
        t || '_read_admin_supervisor', t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. user_badges -> owner OR admin.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('innovation.user_badges') is not null then
    drop policy if exists user_badges_read_own_or_admin on innovation.user_badges;
    create policy user_badges_read_own_or_admin on innovation.user_badges
      for select to authenticated
      using (user_id = auth.uid() or innovation.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. teams -> team members OR admin. Replaces 00022 `teams_select`
--    (leader is auto-inserted into team_members, so leader read is preserved).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('innovation.teams') is not null then
    drop policy if exists teams_select on innovation.teams;
    drop policy if exists teams_read_member_or_admin on innovation.teams;
    create policy teams_read_member_or_admin on innovation.teams
      for select to authenticated
      using (
        innovation.is_admin() or
        exists (
          select 1 from innovation.team_members tm
          where tm.team_id = teams.id and tm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. team_members -> own membership, own team roster, OR admin.
--    Replaces 00022 `team_members_select`.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('innovation.team_members') is not null then
    drop policy if exists team_members_select on innovation.team_members;
    drop policy if exists team_members_read_own_team_or_admin on innovation.team_members;
    create policy team_members_read_own_team_or_admin on innovation.team_members
      for select to authenticated
      using (
        innovation.is_admin() or
        user_id = auth.uid() or
        exists (
          select 1 from innovation.team_members tm2
          where tm2.team_id = team_members.team_id and tm2.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. INTENTIONALLY UNCHANGED: activities, media_assets, knowledge_articles,
--    badges. These are content tables and remain public-read (using (true)).
--    REVIEW: if any of these ever carry PII, scope the exposed columns behind a
--    security_invoker view (see innovation.public_participant_profile in
--    sql_pending/01) rather than widening the row policy.
-- ---------------------------------------------------------------------------

-- Verification (run after applying):
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'innovation'
--     and tablename in (
--       'benefits','ip_records','pilots','implementations','funding_requests',
--       'user_badges','teams','team_members',
--       'activities','media_assets','knowledge_articles','badges'
--     )
--   order by tablename, policyname;
--
-- Expected: NO `read_auth_*` rows on the 8 tightened tables; new scoped
-- policies present (<t>_read_admin_supervisor, user_badges_read_own_or_admin,
-- teams_read_member_or_admin, team_members_read_own_team_or_admin). The 4
-- content tables are unaffected.
--   select innovation.is_supervisor();  -- boolean for the current user
