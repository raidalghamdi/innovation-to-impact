-- Migration 00010 — Reconcile innovation.assignments for the WS3 evaluator UI
-- Purpose: the WS3 evaluator assignments UI expects a table shape
--   (evaluator_id, assigned_by, assigned_at, due_at, notes, status IN
--    ('pending','completed','declined')) that differs from the legacy shape
--   (owner_id/due_date/department/status='open') that was actually installed in
--   the live innovation schema (from an earlier merge of 00001 into innovation).
--
-- Strategy: if the legacy shape is present in innovation.assignments (detected
--   by the presence of column `owner_id`), DROP it (no FKs reference it and
--   only 2 legacy seed rows exist — verified). Then create the WS3 shape.
--   If the WS3 shape is already present, leave everything alone.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04 (amended)
-- Runs manually — do NOT auto-apply.

begin;

-- ---------------------------------------------------------------------------
-- 0. Drop the legacy innovation.assignments shape if we detect it.
--    Detection: presence of column `owner_id` (WS3 shape uses `evaluator_id`).
--    Also drops the legacy policies (admin_all_assignments, read_anon_assignments,
--    read_auth_assignments) because they will not match the new column names.
-- ---------------------------------------------------------------------------
do $$
declare
  legacy_here boolean;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema='innovation'
       and table_name='assignments'
       and column_name='owner_id'
  ) into legacy_here;

  if legacy_here then
    raise notice 'Dropping legacy innovation.assignments (owner_id shape) to recreate in WS3 shape.';
    drop table innovation.assignments cascade;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Create innovation.assignments in the WS3 shape.
-- ---------------------------------------------------------------------------
create table if not exists innovation.assignments (
  id            uuid primary key default gen_random_uuid(),
  idea_id       uuid not null references innovation.ideas(id) on delete cascade,
  evaluator_id  uuid references innovation.user_profiles(id) on delete set null,
  assigned_by   uuid references innovation.user_profiles(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  due_at        timestamptz,
  status        text not null default 'pending'
                check (status in ('pending','completed','declined')),
  notes         text,
  created_at    timestamptz not null default now()
);

-- Helpful lookup indexes for the queue and heatmap queries.
create index if not exists idx_assignments_evaluator_status
  on innovation.assignments (evaluator_id, status);
create index if not exists idx_assignments_idea
  on innovation.assignments (idea_id);
create index if not exists idx_assignments_due_at
  on innovation.assignments (due_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Backfill from legacy public.assignments if it exists (fresh install case).
--    Skipped silently if public.assignments is absent.
-- ---------------------------------------------------------------------------
do $$
declare
  legacy_public_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'assignments'
  ) into legacy_public_exists;

  if legacy_public_exists then
    insert into innovation.assignments (
      id, idea_id, evaluator_id, assigned_at, due_at, status, created_at
    )
    select
      a.id,
      a.idea_id,
      a.owner_id,
      a.created_at,
      case when a.due_date is not null then a.due_date::timestamptz else null end,
      case a.status
        when 'open'      then 'pending'
        when 'closed'    then 'completed'
        when 'cancelled' then 'declined'
        else                  'pending'
      end,
      a.created_at
    from public.assignments a
    where not exists (
      select 1 from innovation.assignments ia where ia.id = a.id
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS: admins full, evaluators see their own rows, submitters see rows
--    tied to their own ideas.
-- ---------------------------------------------------------------------------
alter table innovation.assignments enable row level security;

drop policy if exists assignments_admin_all on innovation.assignments;
create policy assignments_admin_all
  on innovation.assignments
  for all
  to authenticated
  using (
    exists (
      select 1 from innovation.user_profiles up
       where up.id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from innovation.user_profiles up
       where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists assignments_evaluator_own on innovation.assignments;
create policy assignments_evaluator_own
  on innovation.assignments
  for select
  to authenticated
  using (evaluator_id = auth.uid());

drop policy if exists assignments_evaluator_update_own on innovation.assignments;
create policy assignments_evaluator_update_own
  on innovation.assignments
  for update
  to authenticated
  using (evaluator_id = auth.uid())
  with check (evaluator_id = auth.uid());

drop policy if exists assignments_submitter_visibility on innovation.assignments;
create policy assignments_submitter_visibility
  on innovation.assignments
  for select
  to authenticated
  using (
    exists (
      select 1 from innovation.ideas i
       where i.id = innovation.assignments.idea_id
         and i.submitter_id = auth.uid()
    )
  );

commit;

-- POST-VERIFY:
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema='innovation' and table_name='assignments'
--    order by ordinal_position;
--   -- expect: id, idea_id, evaluator_id, assigned_by, assigned_at, due_at,
--   --         status, notes, created_at
--   select status, count(*) from innovation.assignments group by 1;
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists assignments_admin_all             on innovation.assignments;
--   drop policy if exists assignments_evaluator_own         on innovation.assignments;
--   drop policy if exists assignments_evaluator_update_own  on innovation.assignments;
--   drop policy if exists assignments_submitter_visibility  on innovation.assignments;
--   drop table if exists innovation.assignments;
-- commit;
