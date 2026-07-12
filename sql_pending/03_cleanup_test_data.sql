-- 03_cleanup_test_data.sql  (P0 #6 — test / placeholder idea pollution)
--
-- Soft-deletes (status = 'archived') ideas that are obviously test or junk
-- data, matched by EITHER:
--   (a) a run of 4+ identical consecutive characters in title_ar / title_en /
--       problem_statement  — e.g. 'طاااا', 'ههههه', 'xxxx'  (regex (.)\1{3,})
--   (b) a title that starts with a known placeholder token:
--       test | asdf | qwerty | hello | hi | abc   (case-insensitive)
--
-- SAFETY GUARD: never touch a recent real R35 seed. Any idea whose code is
-- >= 'IDEA-2026-045' is preserved regardless of title. Null / lower codes
-- remain eligible.
--
-- Non-destructive: rows are only flipped to 'archived' (soft delete). Each
-- match is announced via RAISE NOTICE with its id, code, title and the reason
-- it was flagged, so the run is fully auditable in the psql output.
--
-- Rollback: set status back to the prior value from your backup / audit_logs;
-- this migration does not record the pre-archive status per row.

set search_path = innovation, public;

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select
      id,
      code,
      coalesce(title_en, title_ar) as display_title,
      case
        when coalesce(title_ar,'') ~ '(.)\1{3,}'
          or coalesce(title_en,'') ~ '(.)\1{3,}'
          or coalesce(problem_statement,'') ~ '(.)\1{3,}'
        then 'repeated-character run (4+ identical consecutive)'
        else 'placeholder title prefix (test/asdf/qwerty/hello/hi/abc)'
      end as reason
    from innovation.ideas
    where status <> 'archived'
      -- keep recent real R35 seeds
      and (code is null or code < 'IDEA-2026-045')
      and (
        coalesce(title_ar,'')          ~ '(.)\1{3,}'
        or coalesce(title_en,'')        ~ '(.)\1{3,}'
        or coalesce(problem_statement,'') ~ '(.)\1{3,}'
        or coalesce(title_ar,'')        ~* '^(test|asdf|qwerty|hello|hi|abc)'
        or coalesce(title_en,'')        ~* '^(test|asdf|qwerty|hello|hi|abc)'
      )
  loop
    -- Comment each match with the reason (visible in the migration output).
    raise notice 'Archiving idea % (code=%) "%": %',
      r.id, coalesce(r.code, '<null>'), r.display_title, r.reason;
    update innovation.ideas
      set status = 'archived', updated_at = now()
      where id = r.id;
    n := n + 1;
  end loop;

  raise notice 'Test-data cleanup complete: % idea(s) archived.', n;
end $$;

-- Verification (run after applying):
--   SELECT code, title_ar, title_en, status FROM innovation.ideas
--   WHERE status = 'archived' ORDER BY code;
--   -- Confirm no idea with code >= 'IDEA-2026-045' was archived by this run.
