-- Migration 00009 — Notifications payload + SLA policy engine
-- Purpose: (1) add innovation.notifications.payload for structured notification
-- context; (2) introduce innovation.sla_policies (target durations per entity
-- transition) and innovation.sla_tracking (in-flight windows per entity), plus
-- default policies for evaluation / idea / committee flows.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.
--
-- NOTE: uses IF NOT EXISTS throughout so it is safe to re-run. The hourly cron
-- (/api/cron/sla-reminders) reads sla_tracking to mark breaches and fan out
-- notifications.

begin;

-- 1. notifications.payload (jsonb) — structured context alongside the existing
--    bilingual title/body/link columns from 00001.
alter table innovation.notifications
  add column if not exists payload jsonb;

-- 2. SLA policies.
create table if not exists innovation.sla_policies (
  id            uuid primary key default gen_random_uuid(),
  name_ar       text,
  name_en       text,
  entity_type   text not null,
  from_state    text,
  to_state      text,
  target_hours  integer not null,
  warn_at_pct   integer not null default 80,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 3. SLA tracking (one row per monitored entity instance).
create table if not exists innovation.sla_tracking (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  policy_id    uuid references innovation.sla_policies(id) on delete set null,
  opened_at    timestamptz not null default now(),
  target_at    timestamptz not null,
  breached_at  timestamptz,
  resolved_at  timestamptz
);

create index if not exists idx_sla_tracking_open
  on innovation.sla_tracking (target_at)
  where resolved_at is null;
create index if not exists idx_sla_tracking_entity
  on innovation.sla_tracking (entity_type, entity_id);

-- 4. Default policies. Guarded so re-runs don't duplicate (match on the
--    entity_type + from_state + to_state triple).
insert into innovation.sla_policies (name_ar, name_en, entity_type, from_state, to_state, target_hours, warn_at_pct)
select v.name_ar, v.name_en, v.entity_type, v.from_state, v.to_state, v.target_hours, v.warn_at_pct
from (values
  ('إنجاز التقييم', 'Evaluation completion', 'evaluation', 'assigned', 'completed', 72, 80),
  ('بدء مراجعة الفكرة', 'Idea initial review', 'idea', 'submitted', 'under_review', 24, 80),
  ('قرار اللجنة', 'Committee decision', 'committee', 'submitted', 'decided', 168, 80),
  ('معالجة الملاحظات', 'Feedback turnaround', 'idea', 'feedback_requested', 'revised', 120, 80)
) as v(name_ar, name_en, entity_type, from_state, to_state, target_hours, warn_at_pct)
where not exists (
  select 1 from innovation.sla_policies p
  where p.entity_type = v.entity_type
    and coalesce(p.from_state,'') = coalesce(v.from_state,'')
    and coalesce(p.to_state,'')   = coalesce(v.to_state,'')
);

commit;

-- POST-VERIFY:
--   \d innovation.sla_policies
--   \d innovation.sla_tracking
--   select entity_type, from_state, to_state, target_hours from innovation.sla_policies order by 1;
--   select column_name from information_schema.columns
--     where table_schema='innovation' and table_name='notifications' and column_name='payload';

-- ROLLBACK (manual):
-- begin;
--   drop table if exists innovation.sla_tracking;
--   drop table if exists innovation.sla_policies;
--   alter table innovation.notifications drop column if exists payload;
-- commit;
