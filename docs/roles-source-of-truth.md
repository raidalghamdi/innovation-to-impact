# Users & Roles — Single Source of Truth (R45)

The whole app reads users and roles from ONE place. All edits happen through the
admin portal only. There must be zero divergence between sources.

## The model

| Object | Role | Notes |
|---|---|---|
| `innovation.user_roles` (M2M) | THE SOURCE OF TRUTH | one row per (user, role); `is_primary` marks the primary role. WRITES go here. |
| `innovation.roles` | role dictionary | `code` (e.g. `evaluator`, `supervisor`) + bilingual names. |
| `innovation.v_user_roles` (view) | THE ONLY READ PATH | joins `user_roles` + `roles`; exposes `user_id, role_code, is_primary, role_active`. |
| `innovation.user_profiles.role` (TEXT) | DEPRECATED | kept for backward safety, kept in sync on write, but NOT read anywhere. |

## Reading roles

Never query `user_profiles.role`. Use `innovation.v_user_roles`, ideally via the
helpers in `src/lib/user-roles.ts`:

```ts
import { getUserRoles, hasRole, listUserIdsByRole } from '@/lib/user-roles';

const codes = await getUserRoles(supabase, userId);        // string[]
const canJudge = await hasRole(supabase, userId, 'judge'); // boolean
const evaluatorIds = await listUserIdsByRole(supabase, ['evaluator', 'judge']);
```

Notes:
- Pass an already-constructed Supabase client. Both the RLS-scoped server client
  and the service-role admin client default to the `innovation` schema, so
  `.from('v_user_roles')` resolves correctly.
- `v_user_roles` is the read path (not `user_roles` directly) because a
  security-definer view returns all matching rows regardless of the caller's RLS
  scope. Reading `user_roles` directly under a non-admin's RLS returns only their
  own rows — this was the root cause of the supervisor's evaluator dropdown
  showing "لا يوجد مقيّمون".
- `src/lib/db-roles.ts` (`getUserRoles`, `getMyUserRoles`, `isCurrentUserAdmin`)
  and `src/lib/users/query-by-role.ts` (`getUsersByRole`) also read
  `v_user_roles` and remain valid entry points.
- `getCurrentUser()` (`src/lib/user.ts`) resolves the app `Role` from
  `v_user_roles` first; it retains a defensive fallback to `user_profiles.role`
  ONLY when the view is unreachable/empty, so a transient view outage cannot
  demote a signed-in user.

## Writing roles

Writes happen exclusively through the admin portal API:

- `POST /api/admin/users` — create a user; inserts `user_roles` and mirrors the
  primary role code into `user_profiles.role`.
- `PATCH /api/admin/users/[id]` — replace a user's roles; rewrites `user_roles`
  and mirrors the new primary role code into `user_profiles.role`.

The mirror keeps the deprecated `user_profiles.role` in sync so any code still
reading it during future transitions stays sane. Before R45, `PATCH` did not
mirror, which is why the legacy column drifted from the source of truth.

`innovation.employee_roles` is a separate, pre-user table used to seed
`user_roles` on an imported employee's first login (see
`src/app/api/auth/login-verify/route.ts`). It is NOT a read source for roles.

## Removed in migration 00038

The abandoned `public.*` role tables from the old system were dropped:
`public.users`, `public.user_roles`, `public.roles`, and (only if they still
referenced those tables) `public.role_permissions` and
`public.user_page_overrides`. Nothing in `src/` references the `public` schema.

Migration `00038_unify_user_role_sources.sql` also backfills
`user_profiles.role` from each user's primary `user_roles` entry.
