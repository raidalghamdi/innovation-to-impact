-- Migration 00011 — Scope-key RBAC columns on innovation.user_profiles
-- Purpose: WS5 analytics scoping. `getScope()` (src/lib/scope.ts) narrows what a
--   non-admin sees:
--     • department      — the user's org unit (department-scoped tables)
--     • allowed_themes  — the strategic themes a judge may drill into
--   Admins ignore both (they see everything).
-- Idempotent: only adds columns that are missing, so it is safe to re-run and
--   safe whether or not the base schema already carried `department`.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

alter table innovation.user_profiles
  add column if not exists department text;

alter table innovation.user_profiles
  add column if not exists allowed_themes uuid[] not null default '{}'::uuid[];

-- Speeds up the department-narrowed analytics queries.
create index if not exists idx_user_profiles_department
  on innovation.user_profiles (department);

-- GIN index so `allowed_themes @> ARRAY[...]` / containment stays fast as the
-- judge roster grows.
create index if not exists idx_user_profiles_allowed_themes
  on innovation.user_profiles using gin (allowed_themes);

commit;

-- POST-VERIFY:
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'innovation'
--      and table_name = 'user_profiles'
--      and column_name in ('department', 'allowed_themes');
--   -- expect two rows: department (text), allowed_themes (ARRAY)
--
-- To grant a judge access to specific themes:
--   update innovation.user_profiles
--      set allowed_themes = ARRAY['<theme-uuid-1>','<theme-uuid-2>']::uuid[]
--    where id = '<judge-uuid>';
--
-- ROLLBACK (manual):
-- begin;
--   drop index if exists innovation.idx_user_profiles_allowed_themes;
--   drop index if exists innovation.idx_user_profiles_department;
--   alter table innovation.user_profiles drop column if exists allowed_themes;
--   -- NOTE: only drop `department` if it was introduced by THIS migration;
--   -- the base schema (00001) also defines it.
--   -- alter table innovation.user_profiles drop column if exists department;
-- commit;
