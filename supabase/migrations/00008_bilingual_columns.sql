-- Migration 00008 — Dual-column bilingual content model
-- Purpose: give every user-facing free-text column an `_ar` / `_en` variant so
--   the read path can use pick() / pickFromRow() (see
--   docs/bilingual-schema-convention.md) and the write path can render two
--   inputs side-by-side. Existing single-language columns are KEPT for backward
--   compatibility; new columns are backfilled from them via COALESCE.
--
-- Schema note: the live objects are in `innovation.*` (the app's supabase client
--   sets db.schema = 'innovation'), NOT the outdated `public.*` scaffolding in
--   00001. Column names below mirror the app's read model — verify against the
--   live innovation schema before running.
--
-- Deviations from the WS4 brief (brief column names vs. actual schema):
--   • ideas: the brief's "description"/"expected_impact" do not exist; the real
--     free-text columns are problem_statement, proposed_solution,
--     expected_benefits. title_ar/title_en already exist (title_en backfilled).
--   • strategic_themes / activities: name_ar/name_en already exist; only the
--     single-language description / target_audience needed variants. No
--     "summary" column exists on activities.
--   • benefits: has no free-text title/description columns today; description_ar
--     / description_en are added per the convention but have no source to
--     backfill (left NULL).
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

-- 1. ideas ------------------------------------------------------------------
alter table innovation.ideas
  add column if not exists problem_statement_ar  text,
  add column if not exists problem_statement_en  text,
  add column if not exists proposed_solution_ar  text,
  add column if not exists proposed_solution_en  text,
  add column if not exists expected_benefits_ar  text,
  add column if not exists expected_benefits_en  text;

-- Backfill: copy the existing single-language value into BOTH variants so
-- neither locale renders blank; also ensure title_en has a value.
update innovation.ideas set
  problem_statement_ar = coalesce(problem_statement_ar, problem_statement, ''),
  problem_statement_en = coalesce(problem_statement_en, problem_statement, ''),
  proposed_solution_ar = coalesce(proposed_solution_ar, proposed_solution, ''),
  proposed_solution_en = coalesce(proposed_solution_en, proposed_solution, ''),
  expected_benefits_ar = coalesce(expected_benefits_ar, expected_benefits, ''),
  expected_benefits_en = coalesce(expected_benefits_en, expected_benefits, ''),
  title_en             = coalesce(title_en, title_ar);

-- 2. strategic_themes -------------------------------------------------------
alter table innovation.strategic_themes
  add column if not exists description_ar text,
  add column if not exists description_en text;

update innovation.strategic_themes set
  description_ar = coalesce(description_ar, description, ''),
  description_en = coalesce(description_en, description, '');

-- 3. activities -------------------------------------------------------------
alter table innovation.activities
  add column if not exists target_audience_ar text,
  add column if not exists target_audience_en text;

update innovation.activities set
  target_audience_ar = coalesce(target_audience_ar, target_audience, ''),
  target_audience_en = coalesce(target_audience_en, target_audience, '');

-- 4. benefits ---------------------------------------------------------------
-- No prior single-language title/description columns exist; added per the
-- bilingual convention for future benefit descriptions. Nothing to backfill.
alter table innovation.benefits
  add column if not exists title_ar       text,
  add column if not exists title_en       text,
  add column if not exists description_ar text,
  add column if not exists description_en text;

commit;

-- POST-VERIFY ----------------------------------------------------------------
--   select column_name from information_schema.columns
--     where table_schema = 'innovation' and table_name = 'ideas'
--       and column_name like '%\_ar' escape '\';
--   -- expect: title_ar, problem_statement_ar, proposed_solution_ar,
--   --         expected_benefits_ar
--   select count(*) from innovation.ideas where problem_statement_ar is null;
--   -- expect: 0
--
-- ROLLBACK (uncomment to reverse) --------------------------------------------
--   begin;
--   alter table innovation.ideas
--     drop column if exists problem_statement_ar,
--     drop column if exists problem_statement_en,
--     drop column if exists proposed_solution_ar,
--     drop column if exists proposed_solution_en,
--     drop column if exists expected_benefits_ar,
--     drop column if exists expected_benefits_en;
--   alter table innovation.strategic_themes
--     drop column if exists description_ar,
--     drop column if exists description_en;
--   alter table innovation.activities
--     drop column if exists target_audience_ar,
--     drop column if exists target_audience_en;
--   alter table innovation.benefits
--     drop column if exists title_ar,
--     drop column if exists title_en,
--     drop column if exists description_ar,
--     drop column if exists description_en;
--   -- title_en backfill is not reversed (original NULLs are not restorable).
--   commit;
