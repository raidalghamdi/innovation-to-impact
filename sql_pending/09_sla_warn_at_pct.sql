-- 09_sla_warn_at_pct.sql  (P1 responsiveness — tighten 24h SLA warn threshold)
--
-- Context: Missing 3.1 asked to run /api/cron/sla-reminders hourly instead of
-- daily. Vercel's Hobby plan only permits ONE cron that fires once per day
-- (see the plan notes in src/lib/weekly-briefing.ts and the cron route), and
-- the weekly-briefing piggyback has only a day-of-week guard — an hourly cron
-- would re-send the Monday briefing every hour. Until the project moves to a
-- Vercel plan that allows sub-daily crons, the cron stays daily and we instead
-- widen the warning window: the 24h "Idea initial review" policy now warns at
-- 60% of the budget (~14.4h in) rather than 80% (~19.2h in), so a single daily
-- pass is more likely to surface a "deadline approaching" reminder before the
-- breach. Runs manually — do NOT auto-apply.

begin;

update innovation.sla_policies
   set warn_at_pct = 60
 where entity_type = 'idea'
   and coalesce(from_state, '') = 'submitted'
   and coalesce(to_state, '')   = 'under_review'
   and target_hours = 24
   and warn_at_pct = 80;

commit;

-- POST-VERIFY:
--   select name_en, target_hours, warn_at_pct from innovation.sla_policies
--    where entity_type='idea' and to_state='under_review';   -- expect warn_at_pct=60

-- ROLLBACK (manual):
-- begin;
--   update innovation.sla_policies set warn_at_pct = 80
--    where entity_type='idea' and coalesce(from_state,'')='submitted'
--      and coalesce(to_state,'')='under_review' and target_hours=24;
-- commit;
