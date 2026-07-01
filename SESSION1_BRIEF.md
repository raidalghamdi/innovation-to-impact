# Innovation-to-Impact — Session 1 Execution Brief

## Project
- Path: `/home/user/workspace/innovation-to-impact`
- Framework: Next.js 14 App Router, next-intl v3, Tailwind, Supabase, Vercel
- Live: https://innovation-to-impact.vercel.app
- Deploy: `npx --no-install vercel deploy --prod --token $VERCEL_TOKEN --yes` with `api_credentials=["vercel"]`, timeout 540000ms, **WITHOUT** `--prebuilt`
- Supabase project ID: `ejcxwicwduyvqdxdkbyo` (icbank) — use `api_credentials=["supabase"]` or the supabase MCP connector

## Brand (from Style Guide)
- Colors: Moon Raker `#1C4854`, Swans Down `#4ABFCD`, Swans Down light `#D8EFE5`, Humming Bird `#CFEDF8`, Shark `#232529`
- Fonts: IBM Plex Sans Arabic (AR), Inter (EN) — already configured
- Logos in `public/brand/`:
  - `Competition-Innovation-Program-logo.svg` (colored — blue/yellow/green)
  - `Competition-Innovation-Program-logo-white.svg` (white for dark bg)
  - `brnmj-btkr-lmnfs.svg` (Arabic wordmark: برنامج ابتكار المنافسة)

## Demo Accounts (Supabase Auth)
- Existing: `innovator@gac-demo.sa` / `Demo2026!` (UUID: `d3f5623c-5241-4d9e-b345-3fb479cdb943`)
- CREATE 4 new demo accounts (all password `Demo2026!`):
  - `submitter@gac-demo.sa`
  - `evaluator@gac-demo.sa`
  - `judge@gac-demo.sa`
  - `admin@gac-demo.sa`

## Patterns (MUST follow)
- Locale chevron: `const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;`
- Import `Link` from `@/i18n/routing` NOT `next/link`
- Server components: `createClient` from `@/lib/supabase/server`
- Every page: `setRequestLocale(locale)` + `const t = await getTranslations(...)`
- Array translations: `t.raw('sections')`
- No emoji-only UI — always pair icons with lucide-react

## SESSION 1 SCOPE (Phases A–K, O, P, Q — 27 tasks)

### Phase A — Critical Bugs (Tasks 1–3)
1. **Fix redirect after idea submit**: After successful idea creation in `src/components/idea-form.tsx`, redirect to `/[locale]/my-ideas` — NOT to `/login`. Check the submit handler and any auth state issue.
2. **Content stability on refresh**: Ensure server components fetch fresh data. Investigate any client-side state that resets on refresh (hero, dashboard stats, etc.). Use `revalidatePath` in server actions after mutations.
3. **Delete /challenges route entirely**: Remove `src/app/[locale]/challenges/` dir, `src/components/challenge-form.tsx`, all challenge entries in `messages/ar.json` and `messages/en.json`, remove from `sidebar-nav.tsx`. Add 301 redirect in `next.config.js` from `/[locale]/challenges` → `/[locale]/ideas`.

### Phase B — DB Schema + RLS (Tasks 4–5)
Create migration `00004_platform_overhaul.sql` with:

```sql
-- USERS PROFILE (extend auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  full_name_ar text,
  email text unique,
  role text not null default 'submitter' check (role in ('submitter','evaluator','judge','admin')),
  organization text,
  department text,
  phone text,
  avatar_url text,
  points int default 0,
  level int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- IDEAS LIFECYCLE (extend existing ideas table)
alter table public.ideas
  add column if not exists lifecycle_status text default 'draft'
  check (lifecycle_status in ('draft','submitted','under_review','feedback_requested','revised','approved','rejected','pilot','implemented','archived')),
  add column if not exists rejection_reason text,
  add column if not exists rejection_reason_ar text,
  add column if not exists revision_count int default 0,
  add column if not exists parent_idea_id uuid references public.ideas(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz;

-- EVALUATIONS
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete cascade,
  evaluator_id uuid references public.profiles(id),
  strategic_alignment int check (strategic_alignment between 1 and 5),
  innovation int check (innovation between 1 and 5),
  feasibility int check (feasibility between 1 and 5),
  impact int check (impact between 1 and 5),
  effort int check (effort between 1 and 5),
  total_score decimal(4,2),
  comment text,
  comment_ar text,
  recommendation text check (recommendation in ('approve','revise','reject','escalate')),
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  title_ar text not null,
  body text,
  body_ar text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- AUDIT LOG
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- FEEDBACK (from evaluators to submitters)
create table if not exists public.idea_feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete cascade,
  from_user_id uuid references public.profiles(id),
  message text not null,
  message_ar text,
  requires_revision boolean default false,
  created_at timestamptz default now()
);

-- CMS CONTENT (for content pages)
create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text,
  title_ar text,
  body jsonb, -- structured content
  body_ar jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

-- Enable RLS on all new tables
alter table public.profiles enable row level security;
alter table public.evaluations enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.idea_feedback enable row level security;
alter table public.cms_content enable row level security;

-- Policies (SUMMARY — write full policies)
-- profiles: self can read/update, admin can all
-- evaluations: evaluator self CRUD, submitter of the idea can read, admin all
-- notifications: user reads/updates own
-- audit_log: admin read only
-- idea_feedback: idea owner reads, evaluator creates, admin all
-- cms_content: public read, admin write
```

Then **eliminate demo-data fallback**: modify `src/lib/data.ts` to always use Supabase; delete `src/lib/demo-data.ts`. If Supabase env vars missing, throw a build-time error.

**Seed 4 role profiles** after creating auth users:
```sql
insert into profiles (id, full_name, full_name_ar, email, role) values
  ('<submitter-uuid>', 'Demo Submitter', 'مقدّم تجريبي', 'submitter@gac-demo.sa', 'submitter'),
  -- ... etc
on conflict (id) do update set role = excluded.role;
```

### Phase C — IA (Task 6)
- `public/robots.txt`: allow all, sitemap link
- Generate `src/app/sitemap.ts` covering all localized routes
- Add breadcrumb component `src/components/breadcrumbs.tsx` (uses locale routing, JSON-LD)

### Phase D — Roles (Tasks 7–9)
7. Create 4 Supabase auth users via management API or SQL (use service role via the supabase connector). Insert profiles with correct roles.
8. Update `middleware.ts` to fetch user's role from `profiles` and enforce RBAC:
   - `submitter` blocked from `/evaluation`, `/committee`, `/admin`, `/analytics`
   - `evaluator` blocked from `/committee`, `/admin`
   - `judge` blocked from `/admin`
   - `admin` full access
   - On login redirect: submitter→/my-ideas, evaluator→/evaluation, judge→/committee, admin→/admin
   Update `sidebar-nav.tsx` to filter menu items by role (pass role via server component prop).
9. Build **4 role dashboards** as separate route groups OR conditionally render inside `/dashboard`:
   - `/dashboard` (submitter default): my ideas count, points, badges, next steps, notifications
   - `/evaluation` (evaluator): assigned ideas queue, evaluation form, history
   - `/committee` (judge): final decision queue, aggregated scores, recommendation
   - `/admin` (admin): platform metrics, user management, CMS, audit log viewer, funnel

### Phase E — Landing Rebuild (Task 10)
Rewrite `src/app/[locale]/page.tsx`:
- **Rich Hero**: full-width, brand color gradient, logo prominent, tagline (bilingual), two CTAs (primary: قدّم فكرتك / Submit Idea, secondary: تعرّف على البرنامج / Learn More)
- **Countdown Timer**: to end date of current submission window (config in cms_content)
- **Stats strip**: total ideas, submitters, approved, implemented (real from DB)
- **How it works**: 8 stages compressed to 4 visual steps (Ideate → Evaluate → Approve → Implement)
- **Target audience preview** (link to /target-audience)
- **Evaluation criteria preview** (link to /evaluation-criteria)
- **Partners strip**: horizontal scrolling logos (from /partners)
- **FAQ preview**: 3 top questions (link to /faq)
- **Sticky bottom CTA**: "سارع بتقديم فكرتك" — visible on scroll past hero
- Remove duplicate CTAs; one entry point

### Phase F — Content Pages (Tasks 11–18)
Create these localized pages. All server components, `setRequestLocale`, `getTranslations`. Content stored in `messages/{ar,en}.json` under a namespace, OR pull from `cms_content` if slug exists.

11. `/about` — sections: About Authority (GAC), About Program, Objectives, Strategy alignment
12. `/target-audience` — 3 audience cards (entrepreneurs, gov entities, innovation specialists) — matches GAC reference
13. `/evaluation-criteria` — general criteria table (5 criteria × weights) + per-track criteria if applicable
14. `/expected-solutions` — categorized examples of solutions the program seeks
15. `/partners` — grid of partner logos (placeholder logos + names; store in cms_content or i18n)
16. `/faq` — accordion of Q&A (10+ items in each language)
17. `/support` — contact info + contact form (posts to `support_messages` table OR emails to configured address)
18. **Legal Footer**: Add to `app-shell.tsx` (or a new `Footer.tsx` used by public pages):
    - Privacy Policy `/privacy` (basic page)
    - Terms & Conditions `/terms` (basic page)
    - Copyright, social links, quick links

### Phase G — Roadmap + CMS lite (Tasks 19–20)
19. **Roadmap page** `/roadmap` with visual timeline of stages/dates (config in cms_content). Countdown on landing pulls from same source.
20. **CMS lite**: `/admin/cms` page listing `cms_content` rows, edit form (JSON or rich text), only admin can edit.

### Phase H — Brand (Task 21)
21. Update `src/components/logo.tsx`:
    - Use `Competition-Innovation-Program-logo.svg` on light bg
    - Use `Competition-Innovation-Program-logo-white.svg` on dark bg (e.g., hero, footer)
    - Show `brnmj-btkr-lmnfs.svg` as Arabic wordmark next to logo on Arabic locale
    - Remove old text placeholder

### Phase I — Idea Form (Task 22)
22. Rewrite `src/components/idea-form.tsx`:
    - Multi-step (Step 1: Basics, Step 2: Details, Step 3: Attachments, Step 4: Review)
    - Autosave every 10s to a `draft_ideas` table or localStorage
    - Strategic theme field with explanation text under each option (values already documented)
    - Remove: event field, confidentiality field
    - Character limits on textareas with counter (title 200, summary 500, description 3000)
    - Clear attachments section (drag-drop, file list)
    - Progress bar
    - RTL-aware

### Phase J — Stage Rename (Task 23)
23. Update `src/components/stage-timeline.tsx` + i18n. Rename 8 stages to be clearer:
    ```
    1. تسجيل الفكرة → Idea Submission
    2. الفرز الأولي → Initial Screening
    3. التقييم الفني → Technical Evaluation
    4. مراجعة اللجنة → Committee Review
    5. اعتماد المنافسة → Approval
    6. التنفيذ التجريبي → Pilot Implementation
    7. القياس والأثر → Measurement & Impact
    8. التوسع والاعتماد → Scale & Adoption
    ```

### Phase K — Notifications (Task 24)
24. Bell icon in header showing unread count (badge). Dropdown with latest 5. `/notifications` page with full list, mark read, filters. Server action on key events (idea submitted, evaluation received, feedback given) inserts into `notifications`. Basic email via Supabase Edge Function OR queue table for now.

### Phase L — Lifecycle (Task 25)
25. Full lifecycle:
    - Submitter submits → status `submitted`
    - Assigned to evaluator → status `under_review`
    - Evaluator can `approve`/`revise`/`reject`/`escalate`
    - If `revise`: idea goes to `feedback_requested`, submitter sees feedback panel, can create revised version (increment `revision_count`, link `parent_idea_id`), re-submit
    - Committee/judge sees `escalate`d for final call
    - Admin can archive/pilot/implement
    - State machine documented in `src/lib/lifecycle.ts`

### Phase M — Search (Task 26)
26. Global search bar in header. `/search?q=` page. Supabase FTS on `ideas.title`, `ideas.summary`, `ideas.description`. Filters: status, stage, strategic theme, date range. Sort: newest, most-scored, most-viewed. Bilingual search.

### Phase O — A11y (Task 30)
30. WCAG AA:
    - All images `alt`
    - Semantic landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`)
    - Skip-to-content link
    - Focus visible rings (Tailwind `focus-visible:ring-2`)
    - Form labels associated
    - Color contrast audit (Moon Raker on white is fine; check Swans Down variants)
    - `aria-live` for dynamic content (notification count)
    - Keyboard nav for sidebar, dropdowns
    - `lang` attribute on `<html>` matches locale, `dir="rtl"` for Arabic (already handled — verify)

### Phase P — Security (Task 31)
31. Audit log wrapper `src/lib/audit.ts`:
    ```ts
    export async function logAction(actor, action, entity_type, entity_id, changes) { ... }
    ```
    Call from: idea create/update/delete, evaluation submit, role change, CMS edit, user login (last_sign_in tracked by supabase). Admin viewer at `/admin/audit`.

### Phase Q — Events (Task 32)
32. `/events` landing with 3 subsections:
    - `/events/main` — main competition event
    - `/events/hackathon` — hackathon
    - `/events/workshops` — workshops list with dates/registration
    Content in cms_content.

### Phase R — Deploy (Task 33)
33. Final steps:
    - `npm run build` locally — fix any TS errors
    - Commit: `git add -A && git commit -m "Session 1: platform overhaul foundation"` (no push if origin missing)
    - Deploy: `npx --no-install vercel deploy --prod --token $VERCEL_TOKEN --yes` with `api_credentials=["vercel"]`, timeout 540000
    - Verify: fetch homepage, /about, /faq, /partners in both locales
    - Login as each demo account and verify correct dashboard redirect

## OUT OF SCOPE (Session 2)
- L: Gamification (points/badges/leaderboard/levels) — schema exists, UI later
- M: AI similarity + pgvector — later
- N: Advanced analytics (funnels, cohorts) — basic dashboard OK now

## Required tools
- Use `bash` for file/npm ops, `edit`/`write` for code
- Use `supabase` connector via `list_external_tools(['supabase'])` for DB migrations + auth user creation
- Use `vercel` for deploy

## Success criteria
- Site loads without errors in AR + EN
- All 4 demo accounts login and redirect to correct dashboard
- /about, /target-audience, /evaluation-criteria, /expected-solutions, /partners, /faq, /support, /privacy, /terms, /events, /notifications, /search, /roadmap all render
- Idea form is multi-step with autosave
- Notification bell shows unread count
- Sidebar filters by role
- Legal footer visible on all public pages
- Countdown + sticky CTA on landing
- Logos display correctly
- /challenges returns 301 redirect to /ideas
- Build passes, deploy succeeds
- README updated with new demo accounts and route map
