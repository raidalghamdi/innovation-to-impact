-- 01_profiles_read_tighten.sql  (P0 #1 — PII leak on innovation.user_profiles)
--
-- Problem
-- -------
-- The `profiles_read` policy has qual = true for {authenticated}: every logged
-- in user can SELECT every profile row — id, full_name, email, role,
-- department, phone. That is a full PII directory leak.
--
-- Fix
-- ---
-- Replace the blanket read policy with three tightly-scoped read policies:
--   profiles_read_own                     -> id = auth.uid()
--   profiles_read_admin                   -> innovation.is_admin()
--   profiles_read_supervisor_participants -> a supervisor may read participant
--                                            (innovator/submitter) rows, for
--                                            messaging. Column exposure is
--                                            further narrowed by the
--                                            public_participant_profile view.
--
-- Evaluators & judges get NO row here — they must never see submitter
-- identity. Instead they render the anonymized pseudonym produced by
-- innovation.anonymous_innovator_label().
--
-- Rollback: recreate `profiles_read` with `using (true)` and drop the three
-- policies + the view + the helper added below.

set search_path = innovation, public;

-- 1. Drop the permissive blanket read policy.
drop policy if exists profiles_read on innovation.user_profiles;

-- 2. Own row.
drop policy if exists profiles_read_own on innovation.user_profiles;
create policy profiles_read_own on innovation.user_profiles
  for select to authenticated
  using (id = auth.uid());

-- 3. Admins read everything.
drop policy if exists profiles_read_admin on innovation.user_profiles;
create policy profiles_read_admin on innovation.user_profiles
  for select to authenticated
  using (innovation.is_admin());

-- 4. Supervisors read participant (innovator/submitter) rows only, so they can
--    message the people whose ideas they oversee. Supervisor identity is
--    resolved via BOTH the multi-role model (v_user_roles.role_code) and the
--    legacy single-value column, matching the rest of the codebase.
drop policy if exists profiles_read_supervisor_participants on innovation.user_profiles;
create policy profiles_read_supervisor_participants on innovation.user_profiles
  for select to authenticated
  using (
    -- target must be a participant (innovator / submitter)
    (
      user_profiles.role in ('innovator', 'submitter')
      or exists (
        select 1 from innovation.v_user_roles tvur
        where tvur.user_id = user_profiles.id
          and tvur.role_code in ('innovator', 'submitter')
      )
    )
    -- current user must be a supervisor
    and (
      exists (
        select 1 from innovation.user_profiles me
        where me.id = auth.uid() and me.role = 'supervisor'
      )
      or exists (
        select 1 from innovation.v_user_roles vur
        where vur.user_id = auth.uid()
          and vur.role_code = 'supervisor'
      )
    )
  );

-- 5. Column-limited surface for reading a participant's public identity.
--    security_invoker = on -> the caller's RLS on user_profiles still applies,
--    so this view can NEVER expose more rows than the policies above allow;
--    it only narrows the *columns* to the four safe fields (no email, no
--    department, no phone). Evaluators/judges therefore get zero rows here and
--    fall back to the anonymized pseudonym.
drop view if exists innovation.public_participant_profile;
create view innovation.public_participant_profile
  with (security_invoker = on) as
  select id, full_name, full_name_ar, role
  from innovation.user_profiles;

grant select on innovation.public_participant_profile to authenticated;

-- 6. Anonymized innovator pseudonym for evaluator / judge surfaces.
--    Returns 'مبتكر #XXX' where XXX = last 3 hex chars of the idea id.
--    Deterministic and stable, reveals nothing about the submitter.
create or replace function innovation.anonymous_innovator_label(idea_id uuid)
returns text
language sql
immutable
as $$
  select 'مبتكر #' || upper(right(replace(idea_id::text, '-', ''), 3));
$$;

grant execute on function innovation.anonymous_innovator_label(uuid) to authenticated;

-- Verification (run after applying):
--   SELECT policyname, cmd, qual FROM pg_policies
--   WHERE schemaname='innovation' AND tablename='user_profiles'
--   ORDER BY policyname;
--   Expected read policies: profiles_read_admin, profiles_read_own,
--   profiles_read_supervisor_participants (NO profiles_read).
--   SELECT innovation.anonymous_innovator_label('00000000-0000-0000-0000-0000000001ab');
--   -> 'مبتكر #1AB'
