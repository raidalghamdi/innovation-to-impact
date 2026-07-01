# Session 2 Brief — Gamification UI + AI Similarity UI + Advanced Analytics UI

Working directory: `/home/user/workspace/innovation-to-impact`
Live: https://innovation-to-impact.vercel.app
Deploy: `npx --no-install vercel deploy --prod --token $VERCEL_TOKEN --yes` with `api_credentials=["vercel"]`, timeout 540000ms, WITHOUT `--prebuilt`

## DB WORK ALREADY DONE (migration 00006 applied)

The Postgres side is complete. Do NOT rewrite it. Just call these from the app:

### Gamification schema (existing in `innovation` schema)
- `user_profiles.points` (int), `user_profiles.level` (int)
- `badges` (code, name, name_ar, description, description_ar, icon, points_reward) — 4 seeded: `first_idea`, `approved_idea`, `evaluator_5`, `implemented`
- `user_badges` (user_id, badge_id, earned_at)
- Triggers auto-award badges + points on idea insert/update and evaluation insert
- Function: `innovation.grant_badge(uid uuid, code text)`
- Function: `innovation.award_points(uid uuid, delta int)`

### AI similarity
- Function: `innovation.find_similar_ideas(query_text text, exclude_id uuid, similarity_threshold real, max_results int) returns table(id, code, title_ar, title_en, status, similarity)`
- Uses pg_trgm — no external API needed, no embedding required for MVP
- `ideas` table has `embedding vector(384)` column for future embedding upgrade
- pg_trgm indexes on `title_ar`, `title_en`, `problem_statement`

### Analytics views (all in `innovation` schema)
- `v_funnel` (stage, n) — idea count per lifecycle stage
- `v_monthly_cohort` (cohort_month, submitted, approved, rejected, implemented)
- `v_theme_activity` (theme_id, name_ar, name_en, n_ideas, n_approved)
- `v_top_evaluators` (id, full_name, full_name_ar, email, n_evaluations, avg_score)
- `v_leaderboard` (id, full_name, full_name_ar, email, role, points, level, n_badges, rank) — top 100 by points
- `v_platform_kpis` (total_submissions, total_approved, total_implemented, active_submitters, total_evaluations, total_users, total_evaluators, realized_financial_impact)

## APP WORK TO DO

### 1. Leaderboard page `/[locale]/leaderboard`
Server component. Fetch from `innovation.v_leaderboard` via server supabase client. Display:
- Podium for top 3 (medal icons, points, level)
- Table for ranks 4–100 with columns: rank, name (locale-aware), role badge, level, points, n_badges
- Show current user's rank prominently if signed in
- Bilingual, RTL-aware
- Link to page from sidebar (all roles can view) and from dashboard

### 2. User badges & points display
- Update `/dashboard` (submitter home) to show current points, level, badge grid (earned + not-earned states)
- Add `PointsBadge` component: shows level (1-99) + points inline in header near notification bell
- Query `user_badges JOIN badges` for earned; query all badges from `badges` table for not-earned
- Compact card: icon, name (locale), description (locale), earned_at (if earned) or "locked" state

### 3. AI similarity in idea form
- In `src/components/idea-form.tsx`, add debounced similarity check on the title field (400ms after typing stops)
- Call `supabase.rpc('find_similar_ideas', { query_text: title, exclude_id: null, similarity_threshold: 0.2, max_results: 5 })`
- Show suggestion panel: "Ideas similar to yours" with title (locale-aware) + similarity % + link to view
- Non-blocking — user can still submit. If ≥3 highly-similar results (>0.5), show a gentle nudge "Consider joining/refining an existing idea"
- Locale-aware panel labels via i18n

### 4. Related-ideas panel on `/[locale]/ideas/[id]`
- On the idea detail page, after loading the idea, run `find_similar_ideas` with the idea's text and its own id excluded
- Show "Related Ideas" section with 5 suggestions

### 5. Admin analytics dashboard `/[locale]/admin/analytics`
Admin-only (RBAC enforced). Server component. Query the 5 views. Render:
- **KPI cards row**: v_platform_kpis fields as tiles (total submissions, approved, implemented, active submitters, total evaluations, total users, realized financial impact in SAR)
- **Funnel chart**: v_funnel — horizontal bar chart (SVG or minimal CSS), stage on y, count on x. Use brand-teal shades from tailwind.
- **Monthly cohort chart**: v_monthly_cohort — stacked bar or grouped bar per month; 4 series (submitted/approved/rejected/implemented). Use `<svg>` inline or a lightweight lib; do NOT add heavy chart deps.
- **Theme activity table**: v_theme_activity
- **Top evaluators table**: v_top_evaluators
- Add link "Analytics" in admin sidebar (already role-filtered)
- Use existing chart color sequence from design-foundations (teal, terra, dark teal, cyan, mauve)

### 6. Wire up in the app
- `src/lib/gamification.ts` — helper: `getUserPoints(userId)`, `getUserBadges(userId)`, `getAllBadges()`
- `src/lib/similarity.ts` — helper: `findSimilarIdeas(text, excludeId?)`
- `src/lib/analytics.ts` — helpers to fetch each view
- Update `sidebar-nav.tsx` to add Leaderboard link (all roles), Analytics link (admin only)
- Update messages (`messages/ar.json`, `messages/en.json`) with new namespaces: `leaderboard.*`, `gamification.*`, `similarity.*`, `analytics.*`

### 7. Update README + report
- Add Session 2 features section
- Write `/home/user/workspace/innovation-to-impact/SESSION2_REPORT.md`

### 8. Build + deploy
- `npm run build` — MUST pass
- Commit: `git add -A && git commit -m "Session 2: gamification UI + AI similarity UI + analytics dashboard"`
- Deploy: `npx --no-install vercel deploy --prod --token $VERCEL_TOKEN --yes` with `api_credentials=["vercel"]`, timeout 540000
- Verify with curl: /leaderboard, /admin/analytics (redirects for non-admin OK), sample ideas page

## PATTERNS TO FOLLOW
- Import `Link` from `@/i18n/routing`
- Server components: `import { createClient } from '@/lib/supabase/server'`
- Client components: `'use client'` + `import { createClient } from '@/lib/supabase/client'`
- Every page: `setRequestLocale(locale)` + `const t = await getTranslations(...)`
- Supabase clients already have `db: { schema: 'innovation' }` — do NOT prefix table names with `innovation.`
- Views can be queried like tables: `supabase.from('v_leaderboard').select('*')`
- RPCs: `supabase.rpc('find_similar_ideas', { ...args })`
- Design colors: `brand-teal`, `brand-teal-light`, `brand-teal-lighter` already in tailwind config
- Use lucide-react for icons
- Chart colors from design-foundations: `#20808D`, `#A84B2F`, `#1B474D`, `#BCE2E7`, `#944454`

## OUT OF SCOPE
- Real embedding model integration (column exists for future; trigram is production-ready for MVP)
- Email delivery of leaderboard summaries
- Streak / weekly / monthly leaderboards (current view is all-time; add later)

## SUCCESS CRITERIA
- `npm run build` passes
- Site deployed with `/leaderboard`, `/admin/analytics` live
- Idea form shows similarity suggestions as user types title
- Idea detail page shows related ideas
- Dashboard shows user points, level, badges
- Sidebar filters correctly (Analytics visible only to admin)
- No regressions on existing pages
