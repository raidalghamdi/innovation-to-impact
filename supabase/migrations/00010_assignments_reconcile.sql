-- Migration 00010 — Reconcile innovation.assignments for the WS3 evaluator UI
-- Purpose: the WS3 evaluator assignments UI expects a table shape
--   (evaluator_id, assigned_by, assigned_at, due_at, notes, status IN
--    ('pending','completed','declined')) that differs from the legacy
--   public.assignments definition (owner_id/due_date/status='open') laid down
--   in migration 00001.
-- Strategy: create innovation.assignments in the expected shape; if legacy
--   rows exist in public.assignments, port them across with sensible defaults
--   (owner_id → evaluator_id, due_date → due_at, status 'open' → 'pending').
--   Leaves public.assignments untouched so other consumers (if any) keep
--   working.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

-- Idempotent: only create if not already present in the innovation schema.
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

-- Backfill from legacy public.assignments when both schemas coexist. Skipped
-- silently if either side is missing (fresh installs, or already migrated).
do $$
declare
  legacy_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'assignments'
  ) into legacy_exists;

  if legacy_exists then
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

-- RLS: admins full, evaluators see their own rows, submitters see rows for
-- their own ideas (so a submitter can tell an evaluation is in progress).
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
--   select count(*) from innovation.assignments;
--   select status, count(*) from innovation.assignments group by 1;
--   -- as admin: expect full visibility
--   -- as evaluator: expect only rows where evaluator_id = your uid
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists assignments_admin_all             on innovation.assignments;
--   drop policy if exists assignments_evaluator_own         on innovation.assignments;
--   drop policy if exists assignments_evaluator_update_own  on innovation.assignments;
--   drop policy if exists assignments_submitter_visibility  on innovation.assignments;
--   drop table if exists innovation.assignments;
-- commit;
