-- 05_auth_rate_limit.sql  (P1 — brute-force protection on login)
--
-- Problem
-- -------
-- /api/auth/login-start verified email+password with no throttle, so an
-- attacker could try unlimited passwords against a known email.
--
-- Fix
-- ---
-- Record every login attempt in innovation.auth_attempts. The route counts
-- failed attempts per email in a rolling 15-minute window and locks the
-- account (HTTP 429) once 5 failures accumulate; a successful login clears the
-- email's failure rows.
--
-- The table is written/read ONLY via the service-role key (createAdminClient),
-- which bypasses RLS. RLS is enabled with NO policies so it is inaccessible
-- through the authenticated anon/session clients — deny-by-default.
--
-- Rollback: drop table innovation.auth_attempts.

set search_path = innovation, public;

create table if not exists innovation.auth_attempts (
  id           uuid primary key default gen_random_uuid(),
  email        text        not null,
  attempted_at timestamptz not null default now(),
  success      boolean     not null default false
);

-- Hot path: "failed attempts for this email since <window start>".
create index if not exists auth_attempts_email_time_idx
  on innovation.auth_attempts (email, attempted_at desc);

-- Deny-by-default: RLS on, no policies. Only the service-role key (which
-- bypasses RLS) may touch this table.
alter table innovation.auth_attempts enable row level security;

-- Verification (run after applying):
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'auth_attempts'; -- t
--   SELECT count(*) FROM pg_policies
--   WHERE schemaname='innovation' AND tablename='auth_attempts';                  -- 0
