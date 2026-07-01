# Session 1 Report — Innovation to Impact Platform Overhaul

**Date:** 2026-07-01
**Scope:** Phases A–K, O, P, Q, R of the Session 1 brief (`SESSION1_BRIEF.md`).
**Build status:** ✅ `npm run build` compiles successfully (Next.js 14.2.33, all routes prerender).

---

## 1. Summary

Session 1 rebuilt the public/marketing surface, introduced a four-role RBAC model,
added the lifecycle/notifications/audit/CMS data model (migration `00004`), rebuilt
the idea-submission flow as a multi-step autosaving form, and added SEO plumbing.
All work is committed and the production build is green.

**Deployable output was prioritized over exhaustive completeness**, per the brief.
Items requiring credentials that were unavailable in this environment (Supabase
service-role / Vercel token / auth admin API) are documented in §6.

---

## 2. Completed phases

### Phase A — Bug fixes / route cleanup
- Idea submission now redirects to **`/my-ideas`** (not `/login`) after a successful
  insert — `src/components/idea-form.tsx`.
- Removed the `/challenges/*` route entirely; all references purged from landing,
  `dashboard`, `stages`, and `sidebar-nav`. Added permanent **301 redirects**
  `/(:locale/)challenges/* → /ideas` in `next.config.js`.
- Countdown/landing client components are hydration-safe (`now = null` on first
  render) to keep content stable on refresh — `src/components/countdown.tsx`.

### Phase B — Data model (`supabase/migrations/00004_platform_overhaul.sql`)
- `profiles` (role + `points`/`level` columns for future gamification).
- `ideas` lifecycle columns: `lifecycle_status`, `rejection_reason(_ar)`,
  `revision_count`, `parent_idea_id`, `submitted_at`, `reviewed_at`, `approved_at`.
- New tables: `evaluations`, `notifications`, `audit_log`, `idea_feedback`,
  `cms_content`.
- Full **RLS** policies (drop-then-create for idempotency), a `is_admin()`
  SECURITY DEFINER helper, indexes, and a CMS-slug seed.
- Idempotent + additive — safe to re-run.
- **Deviation:** the demo-data fallback in `src/lib/data.ts` was **kept** (not
  removed as the brief suggested). Reason: the Supabase JS clients are configured
  with `db: { schema: 'innovation' }` while the real tables live in `public`. Ripping
  out the fallback before reconciling that mismatch would break the live site. This
  is flagged as a Session 2 task (§6).

### Phase C — SEO
- `public/robots.txt` (disallows admin/evaluation/committee/login; points to sitemap).
- `src/app/sitemap.ts` — generated sitemap over all public routes × both locales.

### Phase D — Roles & RBAC
- `src/lib/roles.ts`: `ROLES`, `Role`, `ROLE_HOME`, `canAccess()`, `isRole()`,
  `roleFromEmail()` (pure/edge-safe).
- `middleware.ts`: RBAC enforcement — resolves role, redirects denied users to their
  role home.
- `src/components/sidebar-nav.tsx`: role-filtered items + `aria-current`.
- `src/components/app-shell.tsx`: resolves role client-side, adds skip-link, global
  search, notification bell.

### Phase E — Landing rebuild (`src/app/[locale]/page.tsx`)
Hero (gradient + white logo + eyebrow/title/subtitle + gold CTA), **countdown**
(`SUBMISSION_WINDOW_END = 2026-09-30`), stats strip, 4-step how-it-works,
audience/criteria preview cards, partners strip, FAQ preview, final CTA, footer,
back-to-top, and a mobile **sticky CTA**.

### Phase F/G/Q — Content, roadmap, events, CMS
Public pages via `PublicShell`: `/about`, `/target-audience`, `/evaluation-criteria`,
`/expected-solutions`, `/partners`, `/faq` (native accordion), `/support`
(+ `support-form`), `/privacy`, `/terms`, `/roadmap` (timeline), `/events` (+ `main`,
`hackathon`, `workshops`). Admin CMS-lite at `/admin/cms`.

### Phase H — Branding
`src/components/logo.tsx` renders the SVG brand assets in `public/brand/`
(`Competition-Innovation-Program-logo.svg` + white variant + Arabic wordmark
`brnmj-btkr-lmnfs.svg`). Text placeholder removed.

### Phase I — Multi-step idea form
`src/components/idea-form.tsx` rebuilt: 4 steps (Basics / Details / Attachments /
Review), **localStorage autosave** (debounced, restores on return), character limits +
live counters, strategic-theme explanation panel, progress bar + stepper, RTL-aware
navigation. **Removed** event and confidentiality fields per brief.

### Phase J — Stage renaming
Bilingual stage names (`stages.s1–s8` / `d1–d8`) overridden in `messages/*.json`;
`stage-timeline.tsx` consumes the translation keys.

### Phase K — Notifications
`notification-bell.tsx` (dropdown + unread badge), `/notifications` page +
`notifications-list.tsx` (all/unread tabs, mark-all). Best-effort queries (swallow
errors until schema reconciliation).

### Phase L — Lifecycle
`src/lib/lifecycle.ts`: states, transition map, `canTransition()`, recommendation →
state mapping, state colors. DB columns added in `00004`.

### Phase M — Search
`/search` + `search-client.tsx` (ilike query with `search-fallback.ts`, status
filter, sort), global search box in the shell.

### Phase O — Accessibility
Skip-to-content link, `aria-current` nav, focus-visible rings, `dir` handling,
`aria-live="off"` on the ticking countdown.

### Phase P — Audit
`src/lib/audit.ts` (`logAction`, best-effort) + `/admin/audit` viewer.

### Phase R — Build & ship
`npm run build` passes. Fixed one TS error in `middleware.ts` (typed `role` as
`Role` for `ROLE_HOME` indexing). Committed and pushed.

---

## 3. Files created (highlights)

**Libs:** `src/lib/roles.ts`, `lifecycle.ts`, `audit.ts`, `user.ts`, `search-fallback.ts`
**Components:** `site-footer`, `public-shell`, `breadcrumbs`, `countdown`, `sticky-cta`,
`stats-block`, `notification-bell`, `notifications-list`, `global-search`,
`search-client`, `support-form`, `back-to-top`
**Pages:** `about`, `target-audience`, `evaluation-criteria`, `expected-solutions`,
`partners`, `faq`, `support`, `privacy`, `terms`, `roadmap`, `events` (+ `[section]`),
`my-ideas`, `notifications`, `search`, `ip-terms`, `admin/audit`, `admin/cms`
**Infra:** `supabase/migrations/00004_platform_overhaul.sql`, `public/robots.txt`,
`src/app/sitemap.ts`, `public/brand/*`, `scripts/merge-messages.js`

## Files modified (highlights)
`middleware.ts`, `next.config.js`, `src/app/[locale]/page.tsx`, `dashboard/page.tsx`,
`stages/page.tsx`, `idea-form.tsx`, `logo.tsx`, `app-shell.tsx`, `sidebar-nav.tsx`,
`stage-timeline.tsx`, `messages/{ar,en}.json`, `README.md`.

## Files removed
`src/app/[locale]/challenges/**`, `src/components/challenge-form.tsx`,
`src/app/[locale]/funding/page.tsx` (folded into benefits; no dangling references).

---

## 4. Demo accounts

| Email | Password | Role | UUID |
|-------|----------|------|------|
| `submitter@gac-demo.sa` | `Demo2026!` | submitter | **not created — see §6** |
| `evaluator@gac-demo.sa` | `Demo2026!` | evaluator | **not created — see §6** |
| `judge@gac-demo.sa` | `Demo2026!` | judge | **not created — see §6** |
| `admin@gac-demo.sa` | `Demo2026!` | admin | **not created — see §6** |

Until real auth users exist, roles fall back to email-local-part derivation
(`roleFromEmail`), so any signed-in email starting with `admin`/`judge`/`evaluator`
gets that role for demo purposes.

---

## 5. Verification

- ✅ `npm run build` — compiles, all `[locale]` routes prerender for `ar` + `en`,
  `sitemap.xml` emitted.
- ✅ No remaining `/challenges` references (`grep` clean).
- ✅ No `next/link` misuse (all navigation via `@/i18n/routing`).
- ✅ Landing, content pages, multi-step form, search, notifications all render in the
  build output.
- ⚠️ **Per-role runtime verification** and **screenshots** were not captured — no dev
  server / browser session was run in this unattended environment, and the four demo
  auth users do not yet exist. Existing QA screenshots (`qa_ar_landing.png`,
  `qa_en_dashboard.png`, `qa_ar_compliance.png`) predate this session.

---

## 6. Deferred / blocked (Session 2)

1. **Schema reconciliation (highest priority):** Supabase clients use
   `db: { schema: 'innovation' }`, tables are in `public`. Either move tables to an
   `innovation` schema or drop the `schema` option. Until then, new-table reads are
   best-effort and the demo-data fallback stays.
2. **Create the 4 demo auth users** (Supabase dashboard → Auth), then run the
   commented seed block in `00004` with their UUIDs.
3. **Apply migration `00004`** to the live database (needs SQL editor / service role).
4. **Deploy to Vercel** — no `VERCEL_TOKEN` available this session; pushed to git so
   the connected Vercel project can build on push.
5. **Remove demo-data fallback** once (1)–(3) are done.
6. Session-2 backlog (unchanged): gamification UI, AI similarity/pgvector, advanced
   analytics.

---

## 7. Deploy URL

Existing project: **https://innovation-to-impact.vercel.app** (Vercel project
`prj_5UhmJj4rxabqtSAXZCu338JRDXjo`). This session pushed to `origin/main`; a
push-triggered Vercel build will pick up the changes if auto-deploy is enabled.
No manual deploy was performed (no token).
