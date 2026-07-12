-- Pending SQL 04 — Editable report/chart titles for the admin Reports Center
-- Purpose: back the rich charts surface at /admin/reports-center with a small
--   key/value table of bilingual titles + subtitles so admins can rename any
--   chart or the hero card from an in-page "Edit Titles" modal without a code
--   deploy. Every row is looked up by a stable `key`; the page falls back to a
--   hardcoded default when a row is missing.
--
-- RLS: admins may read/write everything; all other authenticated users may
--   only read (the titles are shown on the page).
--
-- Author: Raid Alghamdi
-- Date: 2026-07-12
-- Runs manually — do NOT auto-apply. Lives in sql_pending/, not migrations/.

begin;

create table if not exists innovation.report_titles (
  key         text primary key,
  title_ar    text,
  title_en    text,
  subtitle_ar text,
  subtitle_en text,
  updated_by  uuid references innovation.user_profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table innovation.report_titles enable row level security;

-- Admins: full access (they own the Edit Titles modal).
drop policy if exists report_titles_admin_all on innovation.report_titles;
create policy report_titles_admin_all
  on innovation.report_titles
  for all
  to authenticated
  using (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  )
  with check (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  );

-- Everyone else authenticated: read-only.
drop policy if exists report_titles_read_all on innovation.report_titles;
create policy report_titles_read_all
  on innovation.report_titles
  for select
  to authenticated
  using (true);

-- Seed 10 rows (hero + 8 charts + charts section header). ON CONFLICT DO
-- NOTHING keeps admin edits intact if this is re-run.
insert into innovation.report_titles (key, title_ar, title_en, subtitle_ar, subtitle_en) values
  ('reports_center_hero',
   'مركز التقارير التحليلية',
   'Analytics Reports Center',
   'لوحة تفاعلية تغطّي دورة حياة الابتكار من الفكرة إلى الأثر.',
   'An interactive dashboard covering the innovation lifecycle from idea to impact.'),
  ('reports_center_charts_section',
   'المؤشرات البيانية',
   'Visual Indicators',
   'ثمانية رسوم بيانية تلخّص أداء المنصّة.',
   'Eight charts summarising platform performance.'),
  ('chart_a_ideas_by_status',
   'الأفكار حسب الحالة',
   'Ideas by Status',
   'توزيع الأفكار على مراحل الحالة الحالية.',
   'Distribution of ideas across their current status.'),
  ('chart_b_submissions_timeline',
   'الأفكار المقدَّمة عبر الزمن',
   'Ideas Submitted Over Time',
   'عدد الأفكار المقدَّمة شهريًّا.',
   'Monthly count of submitted ideas.'),
  ('chart_c_approval_funnel',
   'مسار الاعتماد',
   'Approval Rate Funnel',
   'من التقديم إلى الفرز والتقييم واللجنة والاعتماد.',
   'From submitted through screened, evaluated, committee, to approved.'),
  ('chart_d_ideas_by_theme',
   'الأفكار حسب المحور الاستراتيجي',
   'Ideas by Strategic Theme',
   'عدد الأفكار المرتبطة بكل محور استراتيجي.',
   'Number of ideas mapped to each strategic theme.'),
  ('chart_e_score_distribution',
   'توزيع درجات التقييم',
   'Evaluation Score Distribution',
   'متوسط الدرجة الكلّية موزّعًا على فئات من 0 إلى 10.',
   'Average total score bucketed from 0 to 10.'),
  ('chart_f_time_to_decision',
   'زمن اتخاذ القرار',
   'Time-to-Decision',
   'متوسّط الأيام في كل مرحلة حتى القرار.',
   'Average days per stage until a decision.'),
  ('chart_g_top_innovators',
   'أبرز المبتكرين',
   'Top Innovators',
   'أعلى عشرة مقدّمين حسب عدد الأفكار المعتمدة.',
   'Top ten submitters by approved idea count.'),
  ('chart_h_committee_trend',
   'اتجاه قرارات اللجنة',
   'Committee Decisions Trend',
   'قرارات القبول والرفض شهريًّا.',
   'Approve and reject decisions per month.')
on conflict (key) do nothing;

commit;

-- POST-VERIFY:
--   select key, title_en from innovation.report_titles order by key;
--   -- as admin: UPDATE succeeds; as non-admin: SELECT ok, UPDATE denied.
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists report_titles_admin_all on innovation.report_titles;
--   drop policy if exists report_titles_read_all  on innovation.report_titles;
--   drop table if exists innovation.report_titles;
-- commit;
