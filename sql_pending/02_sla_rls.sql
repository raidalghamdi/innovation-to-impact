-- 02_sla_rls.sql  (P0 #2, #3 — sla_policies + sla_tracking have no RLS)
--
-- Problem
-- -------
-- innovation.sla_policies and innovation.sla_tracking were created in
-- migration 00009 WITHOUT enabling row level security. With RLS disabled and
-- the tables reachable through the authenticated Supabase client, any signed
-- in user can read (and write) the SLA policy engine and every in-flight SLA
-- window.
--
-- Fix
-- ---
-- Enable RLS on both tables and add:
--   admin      -> ALL   (manage everything)
--   supervisor -> SELECT (operational visibility)
--   everyone else -> no access (no matching policy => denied)
--
-- The hourly cron (/api/cron/sla-reminders) uses the service-role key, which
-- bypasses RLS, so breach detection / notification fan-out is unaffected.
--
-- Rollback: disable RLS on both tables and drop the four policies below.

set search_path = innovation, public;

-- ── sla_policies ────────────────────────────────────────────────────────
alter table innovation.sla_policies enable row level security;

drop policy if exists sla_policies_admin_all on innovation.sla_policies;
create policy sla_policies_admin_all on innovation.sla_policies
  for all to authenticated
  using (innovation.is_admin()) with check (innovation.is_admin());

drop policy if exists sla_policies_supervisor_read on innovation.sla_policies;
create policy sla_policies_supervisor_read on innovation.sla_policies
  for select to authenticated
  using (
    exists (
      select 1 from innovation.user_profiles me
      where me.id = auth.uid() and me.role = 'supervisor'
    )
    or exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid() and vur.role_code = 'supervisor'
    )
  );

-- ── sla_tracking ──────────────────────────────────────────────────────────
alter table innovation.sla_tracking enable row level security;

drop policy if exists sla_tracking_admin_all on innovation.sla_tracking;
create policy sla_tracking_admin_all on innovation.sla_tracking
  for all to authenticated
  using (innovation.is_admin()) with check (innovation.is_admin());

drop policy if exists sla_tracking_supervisor_read on innovation.sla_tracking;
create policy sla_tracking_supervisor_read on innovation.sla_tracking
  for select to authenticated
  using (
    exists (
      select 1 from innovation.user_profiles me
      where me.id = auth.uid() and me.role = 'supervisor'
    )
    or exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid() and vur.role_code = 'supervisor'
    )
  );

-- Verification (run after applying):
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('sla_policies','sla_tracking');   -- both t
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='innovation' AND tablename IN ('sla_policies','sla_tracking')
--   ORDER BY tablename, policyname;
