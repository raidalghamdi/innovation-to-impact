-- 00036_lifecycle_functions.sql
-- R43 Automation (Agent B) — lifecycle state-machine transition functions.
--
-- Three server-side transitions plus a settings helper. All functions are
-- security definer with a fixed search_path so they can be invoked from the
-- RLS-scoped anon client (via supabase.rpc) and still read the innovation
-- schema. Every state change is idempotent: the UPDATE carries a status
-- precondition, so a concurrent "last submitter" race produces exactly one
-- transition and the rest no-op.
--
-- IMPORTANT — enum value note: the live innovation.idea_status enum uses
-- `evaluation` and `committee` for the two review stages (the tokens
-- "under_evaluation" / "under_committee" that appear elsewhere in the codebase
-- are display-only aliases, see src/lib/supervisor-idea-filters.ts). The guards
-- below therefore key on the real enum values `evaluation` and `committee`. The
-- R42-later spec's "under_*" naming is honored semantically, not literally, so
-- the transitions actually fire against live data.
--
-- Track linkage: an idea's "track" is innovation.ideas.strategic_theme_id, and
-- innovation.evaluator_track_assignments.track_id references the same
-- strategic_themes(id) (see 00033). The evaluator-expected join uses that.
--
-- Depends on 00031 (enum values + cache columns), 00032 (admin_settings seeds),
-- 00033 (evaluator_track_assignments), 00034 (committee_criteria).
--
-- Idempotent: create or replace + guarded UPDATEs. Safe to re-run.

set local search_path = innovation, public;

-- ---------------------------------------------------------------------------
-- admin_setting_numeric(key, default) -> numeric
-- Reads a numeric runtime setting from innovation.admin_settings.value (jsonb).
-- Tolerates three encodings: a bare number (7), an object ({"value": 7}), or a
-- numeric string ("7"). Returns the default on any miss, null, or parse error
-- so SQL thresholds are configurable and never hardcoded.
-- ---------------------------------------------------------------------------
create or replace function innovation.admin_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = innovation, public
as $$
declare
  v_raw   jsonb;
  v_inner jsonb;
  v_num   numeric;
begin
  select value into v_raw
  from innovation.admin_settings
  where key = p_key;

  if v_raw is null then
    return p_default;
  end if;

  -- Unwrap {"value": N} if present, else use the raw jsonb.
  if jsonb_typeof(v_raw) = 'object' and v_raw ? 'value' then
    v_inner := v_raw -> 'value';
  else
    v_inner := v_raw;
  end if;

  begin
    if jsonb_typeof(v_inner) = 'number' then
      v_num := (v_inner #>> '{}')::numeric;
    elsif jsonb_typeof(v_inner) = 'string' then
      v_num := (v_inner #>> '{}')::numeric;
    else
      return p_default;
    end if;
  exception when others then
    return p_default;
  end;

  if v_num is null then
    return p_default;
  end if;
  return v_num;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_evaluation_complete(idea) -> text  (Transition T1)
-- Fires when the last assigned evaluator submits. Computes the average score,
-- caches it, and moves the idea to pass_awaiting_attachments (avg >= threshold)
-- or evaluation_failed (avg < threshold). Returns the new status, or null when
-- the idea is not in `evaluation` or not all evaluators have submitted.
-- ---------------------------------------------------------------------------
create or replace function innovation.check_evaluation_complete(p_idea_id uuid)
returns text
language plpgsql
security definer
set search_path = innovation, public
as $$
declare
  v_status    text;
  v_track     uuid;
  v_expected  int;
  v_submitted int;
  v_avg       numeric;
  v_threshold numeric;
  v_new       text;
  v_rows      int;
begin
  select status::text, strategic_theme_id
    into v_status, v_track
  from innovation.ideas
  where id = p_idea_id;

  -- Only act while the idea is in the evaluation stage.
  if v_status is null or v_status <> 'evaluation' then
    return null;
  end if;

  -- Expected evaluators = those assigned to the idea's track. Safety fallback:
  -- if no explicit assignment exists, expect all active evaluator-role users.
  select count(distinct evaluator_id) into v_expected
  from innovation.evaluator_track_assignments
  where track_id = v_track;

  if coalesce(v_expected, 0) = 0 then
    select count(distinct user_id) into v_expected
    from innovation.v_user_roles
    where role_code = 'evaluator'
      and role_active = true;
  end if;

  -- Nothing to gate on yet.
  if coalesce(v_expected, 0) = 0 then
    return null;
  end if;

  -- Submitted evaluations: a finished scorecard has submitted_at set AND a
  -- non-null total_score (drafts / conflict-only rows are skipped).
  select count(*) into v_submitted
  from innovation.evaluations
  where idea_id = p_idea_id
    and submitted_at is not null
    and total_score is not null;

  if v_submitted < v_expected then
    return null;
  end if;

  select round(avg(total_score), 2) into v_avg
  from innovation.evaluations
  where idea_id = p_idea_id
    and submitted_at is not null
    and total_score is not null;

  v_threshold := innovation.admin_setting_numeric('pass_threshold', 7);

  -- Cache the average regardless of the pass/fail outcome.
  update innovation.ideas
     set evaluation_avg_score = v_avg,
         updated_at = now()
   where id = p_idea_id;

  if v_avg >= v_threshold then
    v_new := 'pass_awaiting_attachments';
  else
    v_new := 'evaluation_failed';
  end if;

  -- Idempotent transition: only the first caller (status still 'evaluation')
  -- wins; concurrent last-submitters find 0 rows and no-op.
  update innovation.ideas
     set status = v_new::innovation.idea_status,
         updated_at = now()
   where id = p_idea_id
     and status = 'evaluation';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return null;
  end if;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_committee_complete(idea) -> text  (Transition T3)
-- Fires when the last committee member (judge/committee role) records a
-- decision. Computes the committee score (weighted by committee_criteria when
-- per-member criteria_scores are present, else a flat average of the stored
-- judge score), caches it, and moves the idea to pending_final_ranking.
-- Returns the new status, or null when not in `committee` / not all decided.
-- ---------------------------------------------------------------------------
create or replace function innovation.check_committee_complete(p_idea_id uuid)
returns text
language plpgsql
security definer
set search_path = innovation, public
as $$
declare
  v_status    text;
  v_expected  int;
  v_decided   int;
  v_score     numeric;
  v_weighted  numeric;
  v_rows      int;
begin
  select status::text into v_status
  from innovation.ideas
  where id = p_idea_id;

  if v_status is null or v_status <> 'committee' then
    return null;
  end if;

  -- Expected committee members = active judge/committee-role users.
  select count(distinct user_id) into v_expected
  from innovation.v_user_roles
  where role_code in ('judge', 'committee')
    and role_active = true;

  if coalesce(v_expected, 0) = 0 then
    return null;
  end if;

  select count(distinct decided_by) into v_decided
  from innovation.committee_decisions
  where idea_id = p_idea_id
    and decided_by is not null;

  if v_decided < v_expected then
    return null;
  end if;

  -- Weighted path: when active committee_criteria weights exist AND each
  -- member decision carries a criteria_scores object (attachments jsonb object
  -- keyed by criterion code), score each member as
  -- sum(weight*score)/sum(weight), then average across members.
  select round(avg(per_member.wscore), 2) into v_weighted
  from (
    select cd.decided_by,
           sum(cc.weight * ((cd.attachments -> 'criteria_scores') ->> cc.code)::numeric)
             / nullif(sum(cc.weight), 0) as wscore
    from innovation.committee_decisions cd
    cross join innovation.committee_criteria cc
    where cd.idea_id = p_idea_id
      and cc.active = true
      and jsonb_typeof(cd.attachments) = 'object'
      and (cd.attachments ? 'criteria_scores')
      and ((cd.attachments -> 'criteria_scores') ? cc.code)
    group by cd.decided_by
  ) per_member;

  if v_weighted is not null then
    v_score := v_weighted;
  else
    -- Flat path: average of the per-member score stored in the attachments
    -- array as {"kind":"judge_score","score":N} (current judge route shape).
    select round(avg(ms.score), 2) into v_score
    from (
      select cd.decided_by,
             (
               select (e ->> 'score')::numeric
               from jsonb_array_elements(cd.attachments) e
               where e ->> 'kind' = 'judge_score'
               limit 1
             ) as score
      from innovation.committee_decisions cd
      where cd.idea_id = p_idea_id
        and jsonb_typeof(cd.attachments) = 'array'
    ) ms
    where ms.score is not null;
  end if;

  update innovation.ideas
     set committee_final_score = v_score,
         updated_at = now()
   where id = p_idea_id;

  update innovation.ideas
     set status = 'pending_final_ranking'::innovation.idea_status,
         updated_at = now()
   where id = p_idea_id
     and status = 'committee';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return null;
  end if;

  return 'pending_final_ranking';
end;
$$;

-- ---------------------------------------------------------------------------
-- run_final_ranking() -> (approved_count, not_selected_count, top_n)  (T4)
-- Ranks every pending_final_ranking idea per track by committee_final_score
-- (desc, nulls last) then created_at (asc). The top N per track become
-- approved with a final_rank; the rest become not_selected with a final_rank.
-- A single statement with two disjoint data-modifying CTEs guarantees each row
-- is updated exactly once.
--
-- TODO(cron): invoke on a schedule once the evaluation window closes. For now
-- this is an admin-triggered action (see /api/admin/final-ranking/run).
-- ---------------------------------------------------------------------------
create or replace function innovation.run_final_ranking()
returns table(approved_count int, not_selected_count int, top_n int)
language plpgsql
security definer
set search_path = innovation, public
as $$
declare
  v_top_n int;
begin
  v_top_n := innovation.admin_setting_numeric('top_n', 5)::int;

  return query
  with ranked as (
    select i.id,
           row_number() over (
             partition by i.strategic_theme_id
             order by i.committee_final_score desc nulls last, i.created_at asc
           ) as rn
    from innovation.ideas i
    where i.status = 'pending_final_ranking'
  ),
  approved_upd as (
    update innovation.ideas i
       set status = 'approved'::innovation.idea_status,
           final_rank = r.rn,
           approved_at = now(),
           updated_at = now()
      from ranked r
     where i.id = r.id
       and r.rn <= v_top_n
    returning i.id
  ),
  rejected_upd as (
    update innovation.ideas i
       set status = 'not_selected'::innovation.idea_status,
           final_rank = r.rn,
           updated_at = now()
      from ranked r
     where i.id = r.id
       and r.rn > v_top_n
    returning i.id
  )
  select (select count(*) from approved_upd)::int,
         (select count(*) from rejected_upd)::int,
         v_top_n;
end;
$$;

-- Grants: callable from anon (RLS session), authenticated, and service_role.
grant execute on function innovation.admin_setting_numeric(text, numeric)
  to anon, authenticated, service_role;
grant execute on function innovation.check_evaluation_complete(uuid)
  to anon, authenticated, service_role;
grant execute on function innovation.check_committee_complete(uuid)
  to anon, authenticated, service_role;
grant execute on function innovation.run_final_ranking()
  to anon, authenticated, service_role;

-- Verification (run after applying):
--   SELECT innovation.admin_setting_numeric('pass_threshold', 7);
--   SELECT innovation.admin_setting_numeric('top_n', 5);
--   SELECT * FROM innovation.run_final_ranking();
