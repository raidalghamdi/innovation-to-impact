-- 00033_evaluator_track_assignments.sql
-- R43 Foundation — evaluator ↔ track (strategic theme) mapping (spec sec. 7).
--
-- Many-to-many join binding an evaluator to one or more tracks. Ideas are
-- auto-distributed to every evaluator of their track (no per-idea manual
-- assignment), and the evaluator dashboard filters to the evaluator's tracks
-- via this table.
--
-- Track reference: the app models "tracks" as strategic themes. The live
-- innovation schema has innovation.strategic_themes (see 00008), and there is
-- no innovation.tracks table/view. The FK therefore targets
-- innovation.strategic_themes(id). This is the sole deviation from the spec's
-- literal `innovation.tracks(id)` and is documented in
-- /home/user/workspace/r43_agent_a_summary.md.
--
-- RLS: any authenticated user may read; only supervisors + admins may write.
-- Role detection mirrors 00024/00029 (multi-role v_user_roles.role_code plus
-- the legacy user_profiles.role column).
--
-- Idempotent: create-if-not-exists + drop/create policies. Safe to re-run.

create table if not exists innovation.evaluator_track_assignments (
  id           uuid primary key default gen_random_uuid(),
  evaluator_id uuid not null references auth.users(id) on delete cascade,
  track_id     uuid not null references innovation.strategic_themes(id) on delete cascade,
  assigned_by  uuid references auth.users(id),
  assigned_at  timestamptz not null default now(),
  unique (evaluator_id, track_id)
);

create index if not exists idx_eval_track_evaluator
  on innovation.evaluator_track_assignments (evaluator_id);
create index if not exists idx_eval_track_track
  on innovation.evaluator_track_assignments (track_id);

alter table innovation.evaluator_track_assignments enable row level security;

drop policy if exists eval_track_read on innovation.evaluator_track_assignments;
create policy eval_track_read on innovation.evaluator_track_assignments
  for select to authenticated
  using (true);

drop policy if exists eval_track_supervisor_write on innovation.evaluator_track_assignments;
create policy eval_track_supervisor_write on innovation.evaluator_track_assignments
  for all to authenticated
  using (
    exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid()
        and vur.role_code = any (array['supervisor', 'admin'])
    )
    or exists (
      select 1 from innovation.user_profiles up
      where up.id = auth.uid()
        and up.role = any (array['supervisor', 'admin'])
    )
  )
  with check (
    exists (
      select 1 from innovation.v_user_roles vur
      where vur.user_id = auth.uid()
        and vur.role_code = any (array['supervisor', 'admin'])
    )
    or exists (
      select 1 from innovation.user_profiles up
      where up.id = auth.uid()
        and up.role = any (array['supervisor', 'admin'])
    )
  );

grant select on innovation.evaluator_track_assignments to authenticated;
grant insert, update, delete on innovation.evaluator_track_assignments to authenticated;

-- Verification (run after applying):
--   SELECT count(*) FROM innovation.evaluator_track_assignments;
