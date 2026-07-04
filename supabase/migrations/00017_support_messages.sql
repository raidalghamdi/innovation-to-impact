-- Migration 00017 — Support messages inbox
-- Purpose: persist the public support form submissions. The form
-- (src/components/support-form.tsx) already writes to this table with a
-- best-effort try/catch — this migration makes those writes succeed and gives
-- admins a queryable inbox.
--
-- Shape mirrors the form fields exactly: name, email, subject, message.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

create table if not exists innovation.support_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  handled_at  timestamptz,
  handled_by  uuid references innovation.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_support_messages_created
  on innovation.support_messages (created_at desc)
  where handled_at is null;

alter table innovation.support_messages enable row level security;

-- Anyone (including unauthenticated visitors) may submit a support message.
-- The public support page is intentionally open — that's the whole point.
drop policy if exists support_messages_public_insert on innovation.support_messages;
create policy support_messages_public_insert
  on innovation.support_messages
  for insert
  to anon, authenticated
  with check (true);

-- Admins only can read / update / delete.
drop policy if exists support_messages_admin_all on innovation.support_messages;
create policy support_messages_admin_all
  on innovation.support_messages
  for all
  to authenticated
  using (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  )
  with check (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  );

-- Grant so anon can actually INSERT (RLS alone doesn't include the base grant).
grant insert on innovation.support_messages to anon, authenticated;
grant select, update, delete on innovation.support_messages to authenticated;

commit;

-- POST-VERIFY:
--   select count(*) from innovation.support_messages;
--   select policyname, roles, cmd from pg_policies
--    where schemaname='innovation' and tablename='support_messages'
--    order by policyname;
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists support_messages_public_insert on innovation.support_messages;
--   drop policy if exists support_messages_admin_all     on innovation.support_messages;
--   drop table if exists innovation.support_messages;
-- commit;
