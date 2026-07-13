-- 00034_committee_criteria.sql
-- R43 Foundation — dynamic committee (judge) criteria (spec sec. 6.b / 7).
--
-- The committee reviews ideas against a fixed, editable set of weighted
-- criteria configured by supervisors/admins. This table holds those criteria
-- with bilingual names + descriptions and a numeric weight. Read/written by
-- src/lib/committee-criteria.ts.
--
-- RLS: any authenticated user may read; only supervisors + admins may write
-- (role detection mirrors 00024/00029 — v_user_roles.role_code plus the legacy
-- user_profiles.role column).
--
-- Idempotent: create-if-not-exists + drop/create policies + seed via
-- on-conflict-do-nothing (existing edits preserved on re-run).

create table if not exists innovation.committee_criteria (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name_ar        text not null,
  name_en        text not null,
  description_ar text,
  description_en text,
  weight         numeric(5,2) not null default 1.0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table innovation.committee_criteria enable row level security;

drop policy if exists committee_criteria_read on innovation.committee_criteria;
create policy committee_criteria_read on innovation.committee_criteria
  for select to authenticated
  using (true);

drop policy if exists committee_criteria_supervisor_write on innovation.committee_criteria;
create policy committee_criteria_supervisor_write on innovation.committee_criteria
  for all to authenticated
  using (
    exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid()
        and vur.role_code = any (array['supervisor', 'admin'])
    )
    or exists (
      select 1 from innovation.user_profiles up
      where up.id = auth.uid()
        and up.role = any (array['supervisor', 'admin'])
    )
  )
  with check (
    exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid()
        and vur.role_code = any (array['supervisor', 'admin'])
    )
    or exists (
      select 1 from innovation.user_profiles up
      where up.id = auth.uid()
        and up.role = any (array['supervisor', 'admin'])
    )
  );

grant select on innovation.committee_criteria to authenticated;
grant insert, update, delete on innovation.committee_criteria to authenticated;

-- Seed the four default committee criteria (bilingual, weighted).
insert into innovation.committee_criteria (code, name_ar, name_en, weight) values
  ('innovation_originality', 'الأصالة والابتكار', 'Innovation & Originality', 0.30),
  ('feasibility',            'قابلية التطبيق',    'Feasibility',             0.25),
  ('impact',                 'الأثر المتوقع',     'Expected Impact',         0.30),
  ('alignment',              'التوافق الاستراتيجي', 'Strategic Alignment',     0.15)
on conflict (code) do nothing;

-- Verification (run after applying):
--   SELECT code, name_en, weight FROM innovation.committee_criteria ORDER BY code;
