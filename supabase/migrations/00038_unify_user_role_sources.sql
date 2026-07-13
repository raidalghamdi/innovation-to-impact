-- 00038_unify_user_role_sources.sql
-- R45 — Single source of truth for users & roles.
--
-- The app must read users and roles from ONE source only:
--   * innovation.user_roles  (M2M) ......... THE SOURCE OF TRUTH (writes)
--   * innovation.roles ...................... role dictionary (code lookup)
--   * innovation.v_user_roles ............... the only READ path (view)
--
-- innovation.user_profiles.role (legacy singular TEXT) is KEPT and kept in
-- sync for backward safety, but is no longer READ anywhere after R45.
--
-- The abandoned public.* role tables from the old system are removed here.
--
-- Idempotent + guarded throughout. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Backfill safety: keep the legacy user_profiles.role in sync with each
--    user's PRIMARY role from the source of truth. Any code still reading the
--    legacy column during the transition stays sane.
-- ---------------------------------------------------------------------------
UPDATE innovation.user_profiles up
SET role = r.code
FROM innovation.user_roles ur
JOIN innovation.roles r ON r.id = ur.role_id
WHERE ur.user_id = up.id AND ur.is_primary = true;

-- ---------------------------------------------------------------------------
-- 2) Drop abandoned public.* role tables (old system, verified unused).
--    Dependent tables (role_permissions, user_page_overrides) are dropped
--    FIRST, but only when they actually reference the abandoned public tables
--    — so we never touch an unrelated table that happens to share the name.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_refs int;
BEGIN
  -- public.role_permissions
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_permissions'
  ) THEN
    SELECT count(*) INTO v_refs
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'role_permissions'
      AND ccu.table_schema = 'public'
      AND ccu.table_name IN ('users', 'roles', 'user_roles');
    IF v_refs > 0 THEN
      EXECUTE 'DROP TABLE IF EXISTS public.role_permissions CASCADE';
    END IF;
  END IF;

  -- public.user_page_overrides
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_page_overrides'
  ) THEN
    SELECT count(*) INTO v_refs
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'user_page_overrides'
      AND ccu.table_schema = 'public'
      AND ccu.table_name IN ('users', 'roles', 'user_roles');
    IF v_refs > 0 THEN
      EXECUTE 'DROP TABLE IF EXISTS public.user_page_overrides CASCADE';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ---------------------------------------------------------------------------
-- 3) innovation.employee_roles — INVESTIGATED, LEFT IN PLACE.
--    It is actively used by application code and MUST NOT be dropped:
--      * src/app/api/auth/login-verify/route.ts mirrors employee_roles ->
--        user_roles on an imported employee's first login.
--      * src/app/api/admin/roles/[id]/route.ts guards role deletion against it.
--      * src/lib/backup.ts includes it in the platform backup set.
--    No action taken.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4) innovation.v_user_roles already exposes is_primary (used by
--    login-verify to pick the primary role for routing), so no view change is
--    required. Left as-is intentionally.
-- ---------------------------------------------------------------------------
