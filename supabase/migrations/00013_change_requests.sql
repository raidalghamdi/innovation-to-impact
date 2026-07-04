-- Migration 00013 — Change requests kanban (WS7 Data Ingress F4)
-- Purpose: a governance queue for proposed field-level edits to any entity. A
--   requester proposes { current_value -> proposed_value } on a field_path; an
--   admin/judge moves it through requested -> in_review -> approved -> applied
--   (or rejected). Status transitions are guarded in app code (assertTransition
--   pattern, mirroring the idea lifecycle) and every move is audit-logged.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

create table if not exists innovation.change_requests (
  id             uuid primary key default gen_random_uuid(),
  requested_by   uuid references innovation.user_profiles(id) on delete set null,
  entity_type    text not null,
  entity_id      uuid not null,
  field_path     text not null,
  current_value  jsonb,
  proposed_value jsonb,
  reason_ar      text,
  reason_en      text,
  status         text not null default 'requested'
                 check (status in ('requested','in_review','approved','rejected','applied')),
  reviewed_by    uuid references innovation.user_profiles(id) on delete set null,
  reviewed_at    timestamptz,
  applied_at     timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_change_requests_status
  on innovation.change_requests (status, created_at desc);
create index if not exists idx_change_requests_entity
  on innovation.change_requests (entity_type, entity_id);

alter table innovation.change_requests enable row level security;

-- Admins + judges: full access (they run the review queue).
drop policy if exists change_requests_reviewers_all on innovation.change_requests;
create policy change_requests_reviewers_all
  on innovation.change_requests
  for all
  to authenticated
  using (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role in ('admin','judge'))
  )
  with check (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role in ('admin','judge'))
  );

-- Requesters: create and read their own change requests.
drop policy if exists change_requests_requester_own on innovation.change_requests;
create policy change_requests_requester_own
  on innovation.change_requests
  for select
  to authenticated
  using (requested_by = auth.uid());

drop policy if exists change_requests_requester_insert on innovation.change_requests;
create policy change_requests_requester_insert
  on innovation.change_requests
  for insert
  to authenticated
  with check (requested_by = auth.uid());

commit;

-- POST-VERIFY:
--   select status, count(*) from innovation.change_requests group by 1;
--   -- as admin/judge: expect full visibility; as requester: only own rows.
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists change_requests_reviewers_all     on innovation.change_requests;
--   drop policy if exists change_requests_requester_own     on innovation.change_requests;
--   drop policy if exists change_requests_requester_insert  on innovation.change_requests;
--   drop table if exists innovation.change_requests;
-- commit;
