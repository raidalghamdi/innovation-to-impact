-- 00032_admin_settings.sql
-- R43 Foundation — dynamic runtime settings (spec sec. 6.a).
--
-- Key/value store for admin-controlled runtime configuration so numbers like
-- Top-N (approved idea count) and the evaluator Pass Threshold can change
-- without a redeploy or environment variable. Read by src/lib/admin-settings.ts
-- and by the Agent B ranking/threshold automation.
--
-- RLS: any authenticated user may read (dashboards need the values); only
-- admins may write. Admin detection uses innovation.is_admin() (defined in the
-- live schema, used by 00030_report_titles).
--
-- Idempotent: create-if-not-exists + seed via on-conflict-do-nothing so admin
-- edits are never clobbered on re-run.

create table if not exists innovation.admin_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table innovation.admin_settings enable row level security;

drop policy if exists admin_settings_read on innovation.admin_settings;
create policy admin_settings_read on innovation.admin_settings
  for select to authenticated
  using (true);

drop policy if exists admin_settings_admin_write on innovation.admin_settings;
create policy admin_settings_admin_write on innovation.admin_settings
  for all to authenticated
  using (innovation.is_admin()) with check (innovation.is_admin());

grant select on innovation.admin_settings to authenticated;
grant insert, update, delete on innovation.admin_settings to authenticated;

-- Seed defaults: Top-N = 5 approved ideas, Pass Threshold = 7 average score.
insert into innovation.admin_settings (key, value) values
  ('top_n', '{"value": 5}'::jsonb),
  ('pass_threshold', '{"value": 7}'::jsonb)
on conflict (key) do nothing;

-- Verification (run after applying):
--   SELECT key, value FROM innovation.admin_settings ORDER BY key;
