-- Migration 00006 — Standards traceability: compliance_controls columns
-- Purpose: give innovation.compliance_controls a normalized shape mapping
-- Saudi regulatory controls (SDAIA/NDMO/DGA/NCA/CST/RDIA) to platform features
-- and evidence.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.
--
-- NOTE: uses ADD COLUMN IF NOT EXISTS so it is safe on the existing stub. If a
-- legacy free-text `status` column already exists it is left as-is (the enum
-- only applies when the column is created fresh); reconcile manually if needed.

begin;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'compliance_standard_body' and n.nspname = 'innovation') then
    create type innovation.compliance_standard_body as enum ('SDAIA','NDMO','DGA','NCA','CST','RDIA');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'compliance_control_status' and n.nspname = 'innovation') then
    create type innovation.compliance_control_status as enum ('not_started','in_progress','met','not_applicable');
  end if;
end
$$;

alter table innovation.compliance_controls
  add column if not exists standard_body        innovation.compliance_standard_body,
  add column if not exists control_code         text,
  add column if not exists title_ar             text,
  add column if not exists title_en             text,
  add column if not exists description_ar        text,
  add column if not exists description_en        text,
  add column if not exists mapped_feature_paths text[]  default '{}',
  add column if not exists evidence_urls        text[]  default '{}',
  add column if not exists owner_id             uuid,
  add column if not exists status               innovation.compliance_control_status default 'not_started',
  add column if not exists last_reviewed_at     timestamptz;

create unique index if not exists compliance_controls_control_code_key
  on innovation.compliance_controls (control_code);

commit;

-- POST-VERIFY:
--   \d innovation.compliance_controls
--   select standard_body, count(*) from innovation.compliance_controls group by 1;

-- ROLLBACK (manual):
-- begin;
--   drop index if exists innovation.compliance_controls_control_code_key;
--   alter table innovation.compliance_controls
--     drop column if exists standard_body,
--     drop column if exists control_code,
--     drop column if exists title_ar,
--     drop column if exists title_en,
--     drop column if exists description_ar,
--     drop column if exists description_en,
--     drop column if exists mapped_feature_paths,
--     drop column if exists evidence_urls,
--     drop column if exists owner_id,
--     drop column if exists status,
--     drop column if exists last_reviewed_at;
--   drop type if exists innovation.compliance_control_status;
--   drop type if exists innovation.compliance_standard_body;
-- commit;
