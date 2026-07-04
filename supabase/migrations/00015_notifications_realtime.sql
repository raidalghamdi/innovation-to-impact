-- Migration 00015 — Enable Supabase Realtime on innovation.notifications (Cross-cutting F2)
-- Purpose: the notification bell / notifications page subscribe to INSERT
--   events via supabase-js Realtime (postgres_changes). Realtime only streams
--   changes for tables that are members of the `supabase_realtime` publication
--   — by default that publication only tracks `public.*`, so tables living in
--   the `innovation` schema (this project's convention) must be added
--   explicitly.
-- Defensive: wrapped in a DO block so this is a safe no-op on any environment
--   where the publication doesn't exist (unlikely on Supabase, but this
--   mirrors prior migrations' "never break a fresh/partial install" stance)
--   or where innovation.notifications hasn't been created yet, and it's
--   idempotent — re-running after the table is already a publication member
--   doesn't error.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

do $$
begin
  -- Only proceed if both the publication and the target table exist.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (
       select 1 from information_schema.tables
        where table_schema = 'innovation' and table_name = 'notifications'
     )
  then
    -- Idempotent: skip if the table is already a member of the publication.
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'innovation'
         and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table innovation.notifications;
    end if;
  end if;
end $$;

commit;

-- POST-VERIFY:
--   select schemaname, tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'innovation';
--   -- expect a row: innovation | notifications
--
-- If the query above returns no rows, Realtime is not configured for this
-- project (e.g. self-hosted without the realtime service) or the
-- `supabase_realtime` publication has been renamed/removed — the app degrades
-- gracefully (use-notifications-stream.ts's channel simply never fires; the
-- UI keeps working off its initial fetch).
--
-- ROLLBACK (manual):
-- begin;
--   do $$
--   begin
--     if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
--        and exists (
--          select 1 from pg_publication_tables
--           where pubname = 'supabase_realtime'
--             and schemaname = 'innovation'
--             and tablename = 'notifications'
--        )
--     then
--       alter publication supabase_realtime drop table innovation.notifications;
--     end if;
--   end $$;
-- commit;
