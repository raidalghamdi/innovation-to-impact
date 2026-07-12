-- 06_audit_logs_with_check.sql  (P2 — audit trail impersonation)
--
-- Problem
-- -------
-- The INSERT policy on innovation.audit_logs used `with check (true)`, so any
-- authenticated client could insert an audit row with an arbitrary actor_id,
-- forging entries in someone else's name.
--
-- Fix
-- ---
-- Re-create the INSERT policy with a WITH CHECK that only allows a row whose
-- actor_id is the caller (auth.uid()) or where the caller is an admin. The
-- service-role key (used by server-side logAudit) bypasses RLS and is
-- unaffected.
--
-- Rollback: recreate the prior policy with `with check (true)`.

set search_path = innovation, public;

-- Drop whatever INSERT policy currently exists (name-agnostic) so this is
-- idempotent regardless of how the original was named.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'innovation'
      and tablename = 'audit_logs'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on innovation.audit_logs', pol.policyname);
  end loop;
end $$;

create policy audit_logs_insert_self_or_admin on innovation.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() OR innovation.is_admin());

-- Verification (run after applying):
--   SELECT policyname, cmd, with_check FROM pg_policies
--   WHERE schemaname='innovation' AND tablename='audit_logs' AND cmd='INSERT';
