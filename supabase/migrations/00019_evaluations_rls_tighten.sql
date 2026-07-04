-- 00019_evaluations_rls_tighten.sql
-- Remove permissive read-all policies on innovation.evaluations.
--
-- Context
-- -------
-- The consistency + P2 audit found evaluations was carrying TWO leftover
-- policies from the demo seed migration that made all four correctly-scoped
-- policies moot:
--
--   read_anon_evaluations         (anon, SELECT, qual: true)
--   read_auth_evaluations         (authenticated, SELECT, qual: true)
--
-- Because Postgres RLS OR's permissive policies together, these two override
-- the tight ones (`evaluations_select_own`, `evaluations_insert_own`,
-- `evaluations_update_own`, `admin_all_evaluations`). Net effect today:
-- any signed-in user can read every evaluator's scores + comments via the
-- API; any unauthenticated visitor can too (anon SELECT with `using true`).
--
-- After this migration
-- --------------------
-- SELECT: evaluator_id = auth.uid()  OR  is_admin()  OR  is_judge()
-- INSERT: evaluator_id = auth.uid() (already enforced by evaluations_insert_own)
-- UPDATE: evaluator_id = auth.uid()  OR  is_admin() (owner + admin only)
-- Judges get SELECT so committee packs still work; they can't write.
--
-- Rollback: recreate the two dropped policies with the same definitions.

set search_path = innovation, public;

drop policy if exists read_anon_evaluations on innovation.evaluations;
drop policy if exists read_auth_evaluations on innovation.evaluations;

-- Add a judge-read path so committee views keep working. Owner + admin are
-- already covered by the existing `evaluations_select_own` and
-- `admin_all_evaluations` policies.
drop policy if exists evaluations_select_judge on innovation.evaluations;
create policy evaluations_select_judge
  on innovation.evaluations
  for select
  to authenticated
  using (
    exists (
      select 1 from innovation.user_profiles up
      where up.id = auth.uid() and up.role = 'judge'
    )
  );

-- Sanity: re-declare owner-scoped policies idempotently in case an earlier
-- edit dropped one. No-op if they already match.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='evaluations'
      and policyname='evaluations_select_own'
  ) then
    create policy evaluations_select_own on innovation.evaluations
      for select to authenticated
      using (evaluator_id = auth.uid() or innovation.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='evaluations'
      and policyname='evaluations_insert_own'
  ) then
    create policy evaluations_insert_own on innovation.evaluations
      for insert to authenticated
      with check (evaluator_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='innovation' and tablename='evaluations'
      and policyname='evaluations_update_own'
  ) then
    create policy evaluations_update_own on innovation.evaluations
      for update to authenticated
      using (evaluator_id = auth.uid())
      with check (evaluator_id = auth.uid());
  end if;
end $$;

-- Verification query (run after applying):
--   SELECT policyname, roles::text, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname='innovation' AND tablename='evaluations'
--   ORDER BY policyname;
-- Expected 5 rows (no read_anon_*, no read_auth_*):
--   admin_all_evaluations, evaluations_insert_own, evaluations_select_judge,
--   evaluations_select_own, evaluations_update_own.
