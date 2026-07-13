-- 00031_lifecycle_enum_extension.sql
-- R43 — Full lifecycle state machine (Agent A / Foundation).
--
-- Extends innovation.idea_status with the new lifecycle states introduced by
-- the 7-stage state machine (see /home/user/workspace/r42_later_item6_spec.md)
-- and adds three cache columns on innovation.ideas used by the automation
-- agents (evaluator average, committee final score, final Top-N rank).
--
-- Terminology note (spec sec. 3): `evaluation_failed` renders in the UI as
-- "لم تتجاوز التقييم / Did Not Pass Evaluation" and is logically distinct from
-- `not_selected` ("لم تُعتمد / Not Selected"). The enum stores the raw code;
-- display labels live in src/lib/lifecycle-states.ts.
--
-- Note: `in_pilot` already exists in the enum since 00001_initial_schema, so
-- its `add value if not exists` below is a no-op. It is listed for
-- completeness of the R43 lifecycle vocabulary.
--
-- Idempotent: `add value if not exists` + `add column if not exists`. Safe to
-- re-run.

-- 1) New lifecycle enum values.
alter type innovation.idea_status add value if not exists 'pass_awaiting_attachments';
alter type innovation.idea_status add value if not exists 'pending_final_ranking';
alter type innovation.idea_status add value if not exists 'evaluation_failed';
alter type innovation.idea_status add value if not exists 'not_selected';
alter type innovation.idea_status add value if not exists 'in_pilot';
alter type innovation.idea_status add value if not exists 'in_measurement';
alter type innovation.idea_status add value if not exists 'in_scaling';

-- 2) Cache columns on innovation.ideas (populated by Agent B automation
--    triggers T1/T3/T4). Nullable so existing rows are unaffected.
alter table innovation.ideas
  add column if not exists evaluation_avg_score numeric(5,2),
  add column if not exists committee_final_score numeric(5,2),
  add column if not exists final_rank int;

-- Verification (run after applying):
--   SELECT unnest(enum_range(NULL::innovation.idea_status));
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema = 'innovation' AND table_name = 'ideas'
--       AND column_name IN
--         ('evaluation_avg_score','committee_final_score','final_rank');
