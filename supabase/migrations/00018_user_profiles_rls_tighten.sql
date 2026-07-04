-- 00018_user_profiles_rls_tighten.sql
-- Remove anon SELECT on innovation.user_profiles.
--
-- Context
-- -------
-- The consistency audit flagged that `profiles_read_anon` (qual: true) let
-- ANY unauthenticated visitor read the full user directory — id, full_name,
-- email, role, department, phone. That's a real data leak: pre-login, the
-- landing / login / signup pages never query user_profiles, so no legitimate
-- code path depends on this policy. All in-app reads (evaluator picker,
-- points badge, notification recipients, name resolution) run with an
-- authenticated Supabase client and are covered by the `profiles_read`
-- policy (still qual: true for {authenticated}).
--
-- After this migration
-- --------------------
--   anon         : no access (all cmds denied by default)
--   authenticated: SELECT any row (profiles_read),
--                  UPDATE own row (profiles_update_own),
--                  admin has ALL (profiles_admin_all via is_admin())
--
-- Rollback: recreate the policy with the same definition.

set search_path = innovation, public;

drop policy if exists profiles_read_anon on innovation.user_profiles;

-- Sanity: leave the other three policies untouched. If any were dropped by
-- earlier edits, re-declare them idempotently so the target state is explicit.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='user_profiles'
      and policyname='profiles_read'
  ) then
    create policy profiles_read on innovation.user_profiles
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='user_profiles'
      and policyname='profiles_update_own'
  ) then
    create policy profiles_update_own on innovation.user_profiles
      for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='user_profiles'
      and policyname='profiles_admin_all'
  ) then
    create policy profiles_admin_all on innovation.user_profiles
      for all to authenticated
      using (innovation.is_admin()) with check (innovation.is_admin());
  end if;
end $$;

-- Verification query (run after applying):
--   SELECT policyname, roles, cmd, qual FROM pg_policies
--   WHERE schemaname='innovation' AND tablename='user_profiles'
--   ORDER BY policyname;
-- Expected: 3 rows (profiles_admin_all, profiles_read, profiles_update_own).
