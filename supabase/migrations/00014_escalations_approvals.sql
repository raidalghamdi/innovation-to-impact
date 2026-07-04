-- Migration 00014 — Escalations & multi-step approvals (WS6)
-- Purpose: one cohesive escalation + approval system.
--   • escalations / escalation_events — first-class objects tracking who owns an
--     overdue or blocked item now, with a tiered ladder (manager→director→exec).
--   • approval_chains / approval_chain_steps — reusable ordered-step templates any
--     entity can require before a gated lifecycle transition is allowed.
--   • approval_instances / approval_step_decisions — one instance per (entity,chain)
--     with per-approver decisions; a step closes when its min_approvers is met.
--   • user_profiles.escalation_tier — the ladder position bumpEscalation() resolves
--     the next-tier owner from (1=manager, 2=director, 3=exec).
-- Transitions are guarded in app code (assertApprovalComplete, mirroring the idea
--   lifecycle assertTransition pattern) and every move is audit-logged.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

-- ---------------------------------------------------------------------------
-- Escalation ladder position on the profile.
-- ---------------------------------------------------------------------------
alter table innovation.user_profiles
  add column if not exists escalation_tier int not null default 1;

-- ---------------------------------------------------------------------------
-- Escalations — first-class ownership of an overdue/blocked item.
-- ---------------------------------------------------------------------------
create table if not exists innovation.escalations (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null,          -- 'idea' | 'evaluation' | 'committee_decision' | 'change_request' | 'sla'
  entity_id        uuid not null,
  opened_at        timestamptz not null default now(),
  opened_by        uuid references innovation.user_profiles(id) on delete set null,
  reason_ar        text,
  reason_en        text,
  current_level    int not null default 1, -- 1=manager, 2=director, 3=exec
  current_owner_id uuid references innovation.user_profiles(id) on delete set null,
  status           text not null default 'open'
                   check (status in ('open','acknowledged','resolved','cancelled')),
  resolved_at      timestamptz,
  resolved_by      uuid references innovation.user_profiles(id) on delete set null,
  resolution_ar    text,
  resolution_en    text
);

create index if not exists idx_escalations_status
  on innovation.escalations (status, opened_at desc);
create index if not exists idx_escalations_entity
  on innovation.escalations (entity_type, entity_id);
create index if not exists idx_escalations_owner
  on innovation.escalations (current_owner_id);

-- History of level bumps / ownership changes.
create table if not exists innovation.escalation_events (
  id            uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references innovation.escalations(id) on delete cascade,
  event_type    text not null
                check (event_type in ('opened','bumped','ack','resolved','cancelled','reassigned')),
  from_level    int,
  to_level      int,
  from_owner_id uuid references innovation.user_profiles(id) on delete set null,
  to_owner_id   uuid references innovation.user_profiles(id) on delete set null,
  notes_ar      text,
  notes_en      text,
  actor_id      uuid references innovation.user_profiles(id) on delete set null,
  at            timestamptz not null default now()
);

create index if not exists idx_escalation_events_escalation
  on innovation.escalation_events (escalation_id, at desc);

-- ---------------------------------------------------------------------------
-- Approval chains — reusable ordered-step templates.
-- ---------------------------------------------------------------------------
create table if not exists innovation.approval_chains (
  id      uuid primary key default gen_random_uuid(),
  code    text unique not null,           -- e.g. 'committee-publish', 'idea-approve'
  name_ar text,
  name_en text,
  active  boolean not null default true
);

create table if not exists innovation.approval_chain_steps (
  id            uuid primary key default gen_random_uuid(),
  chain_id      uuid not null references innovation.approval_chains(id) on delete cascade,
  step_order    int not null,
  required_role text not null,            -- 'evaluator' | 'judge' | 'admin' | ...
  min_approvers int not null default 1,
  label_ar      text,
  label_en      text,
  unique (chain_id, step_order)
);

-- ---------------------------------------------------------------------------
-- Approval instances — one per (entity, chain) pair.
-- ---------------------------------------------------------------------------
create table if not exists innovation.approval_instances (
  id          uuid primary key default gen_random_uuid(),
  chain_id    uuid not null references innovation.approval_chains(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected','withdrawn')),
  opened_at   timestamptz not null default now(),
  decided_at  timestamptz
);

create index if not exists idx_approval_instances_entity
  on innovation.approval_instances (entity_type, entity_id);
create index if not exists idx_approval_instances_status
  on innovation.approval_instances (status, opened_at desc);

create table if not exists innovation.approval_step_decisions (
  id          uuid primary key default gen_random_uuid(),
  instance_id uuid not null references innovation.approval_instances(id) on delete cascade,
  step_id     uuid not null references innovation.approval_chain_steps(id) on delete cascade,
  approver_id uuid references innovation.user_profiles(id) on delete set null,
  decision    text not null check (decision in ('approve','reject')),
  comment_ar  text,
  comment_en  text,
  decided_at  timestamptz not null default now()
);

create index if not exists idx_approval_step_decisions_instance
  on innovation.approval_step_decisions (instance_id, step_id);

-- ---------------------------------------------------------------------------
-- Seed the two default chains (idempotent — keyed by unique code).
-- ---------------------------------------------------------------------------
insert into innovation.approval_chains (code, name_ar, name_en)
  values ('committee-publish', 'نشر قرار اللجنة', 'Committee publish')
  on conflict (code) do nothing;

insert into innovation.approval_chains (code, name_ar, name_en)
  values ('idea-approve', 'اعتماد الفكرة', 'Idea approval')
  on conflict (code) do nothing;

-- committee-publish: (1) any evaluator score, (2) 2-of-3 judges approve.
insert into innovation.approval_chain_steps (chain_id, step_order, required_role, min_approvers, label_ar, label_en)
  select c.id, 1, 'evaluator', 1, 'تقييم المُقيّم', 'Evaluator scoring'
    from innovation.approval_chains c where c.code = 'committee-publish'
  on conflict (chain_id, step_order) do nothing;

insert into innovation.approval_chain_steps (chain_id, step_order, required_role, min_approvers, label_ar, label_en)
  select c.id, 2, 'judge', 2, 'موافقة اثنين من ثلاثة محكّمين', '2-of-3 judges approve'
    from innovation.approval_chains c where c.code = 'committee-publish'
  on conflict (chain_id, step_order) do nothing;

-- idea-approve: (1) 1 admin.
insert into innovation.approval_chain_steps (chain_id, step_order, required_role, min_approvers, label_ar, label_en)
  select c.id, 1, 'admin', 1, 'موافقة المشرف', 'Admin approval'
    from innovation.approval_chains c where c.code = 'idea-approve'
  on conflict (chain_id, step_order) do nothing;

-- ---------------------------------------------------------------------------
-- RLS. Authenticated users read; admins/judges manage escalations and chains.
-- Approval decisions are inserted by the deciding approver.
-- ---------------------------------------------------------------------------
alter table innovation.escalations            enable row level security;
alter table innovation.escalation_events      enable row level security;
alter table innovation.approval_chains        enable row level security;
alter table innovation.approval_chain_steps   enable row level security;
alter table innovation.approval_instances     enable row level security;
alter table innovation.approval_step_decisions enable row level security;

-- Escalations: admins/judges full access; the current owner and opener can read.
drop policy if exists escalations_reviewers_all on innovation.escalations;
create policy escalations_reviewers_all
  on innovation.escalations for all to authenticated
  using (exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role in ('admin','judge')))
  with check (exists (select 1 from innovation.user_profiles up
                       where up.id = auth.uid() and up.role in ('admin','judge')));

drop policy if exists escalations_participant_read on innovation.escalations;
create policy escalations_participant_read
  on innovation.escalations for select to authenticated
  using (current_owner_id = auth.uid() or opened_by = auth.uid());

-- Escalation events: readable by anyone who can read escalations; writable by reviewers.
drop policy if exists escalation_events_read on innovation.escalation_events;
create policy escalation_events_read
  on innovation.escalation_events for select to authenticated using (true);

drop policy if exists escalation_events_reviewers_write on innovation.escalation_events;
create policy escalation_events_reviewers_write
  on innovation.escalation_events for insert to authenticated
  with check (exists (select 1 from innovation.user_profiles up
                       where up.id = auth.uid() and up.role in ('admin','judge')));

-- Approval chain templates: readable by all authenticated, managed by admins.
drop policy if exists approval_chains_read on innovation.approval_chains;
create policy approval_chains_read
  on innovation.approval_chains for select to authenticated using (true);

drop policy if exists approval_chain_steps_read on innovation.approval_chain_steps;
create policy approval_chain_steps_read
  on innovation.approval_chain_steps for select to authenticated using (true);

drop policy if exists approval_chains_admin_all on innovation.approval_chains;
create policy approval_chains_admin_all
  on innovation.approval_chains for all to authenticated
  using (exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role = 'admin'))
  with check (exists (select 1 from innovation.user_profiles up
                       where up.id = auth.uid() and up.role = 'admin'));

drop policy if exists approval_chain_steps_admin_all on innovation.approval_chain_steps;
create policy approval_chain_steps_admin_all
  on innovation.approval_chain_steps for all to authenticated
  using (exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role = 'admin'))
  with check (exists (select 1 from innovation.user_profiles up
                       where up.id = auth.uid() and up.role = 'admin'));

-- Approval instances: readable by all authenticated; managed by admins/judges.
drop policy if exists approval_instances_read on innovation.approval_instances;
create policy approval_instances_read
  on innovation.approval_instances for select to authenticated using (true);

drop policy if exists approval_instances_reviewers_write on innovation.approval_instances;
create policy approval_instances_reviewers_write
  on innovation.approval_instances for all to authenticated
  using (exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role in ('admin','judge')))
  with check (exists (select 1 from innovation.user_profiles up
                       where up.id = auth.uid() and up.role in ('admin','judge')));

-- Step decisions: readable by all authenticated; each approver inserts their own.
drop policy if exists approval_step_decisions_read on innovation.approval_step_decisions;
create policy approval_step_decisions_read
  on innovation.approval_step_decisions for select to authenticated using (true);

drop policy if exists approval_step_decisions_own_insert on innovation.approval_step_decisions;
create policy approval_step_decisions_own_insert
  on innovation.approval_step_decisions for insert to authenticated
  with check (approver_id = auth.uid());

commit;

-- POST-VERIFY:
--   select code, (select count(*) from innovation.approval_chain_steps s where s.chain_id = c.id) steps
--     from innovation.approval_chains c order by code;
--   -- expect committee-publish=2, idea-approve=1
--   select column_name from information_schema.columns
--    where table_schema='innovation' and table_name='user_profiles' and column_name='escalation_tier';
--
-- To set a user's ladder position (director):
--   update innovation.user_profiles set escalation_tier = 2 where id = '<uuid>';
--
-- ROLLBACK (manual):
-- begin;
--   drop table if exists innovation.approval_step_decisions;
--   drop table if exists innovation.approval_instances;
--   drop table if exists innovation.approval_chain_steps;
--   drop table if exists innovation.approval_chains;
--   drop table if exists innovation.escalation_events;
--   drop table if exists innovation.escalations;
--   alter table innovation.user_profiles drop column if exists escalation_tier;
-- commit;
