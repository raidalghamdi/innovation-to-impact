-- 00030_report_titles.sql
-- Editable bilingual titles for the admin/supervisor Reports Center.
--
-- Backs Report Item 2 (R42-later): admins edit report/chart/section headings in
-- AR + EN and the reports surface renders those overrides, falling back to the
-- hardcoded defaults in src/lib/report-titles.ts when a row (or a field) is
-- absent. The application code (getReportTitles / updateReportTitles) was
-- already merged expecting this table; this migration creates it.
--
-- Schema note: the table keys on a single `key` column (matching the upsert
-- onConflict:'key' in the server action) — each key names one editable element
-- (hero, section header, or an individual chart heading). subtitle_* hold the
-- descriptive line under each title. Blank fields are stored as NULL so the UI
-- falls back to the default for that specific field.

create table if not exists innovation.report_titles (
  key         text primary key,
  title_ar    text,
  title_en    text,
  subtitle_ar text,
  subtitle_en text,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

alter table innovation.report_titles enable row level security;

-- Everyone (authenticated + anon) can read titles so reports render for all
-- roles. Only admins may insert / update / delete.
drop policy if exists report_titles_read on innovation.report_titles;
create policy report_titles_read on innovation.report_titles
  for select using (true);

drop policy if exists report_titles_admin_write on innovation.report_titles;
create policy report_titles_admin_write on innovation.report_titles
  for all to authenticated
  using (innovation.is_admin()) with check (innovation.is_admin());

grant select on innovation.report_titles to anon, authenticated;
grant insert, update, delete on innovation.report_titles to authenticated;

-- Seed defaults (mirrors TITLE_DEFAULTS in src/lib/report-titles.ts). Existing
-- rows are left untouched so admin edits are never clobbered on re-run.
insert into innovation.report_titles (key, title_ar, title_en, subtitle_ar, subtitle_en) values
  ('reports_center_hero',
   'مركز التقارير التحليلية', 'Analytics Reports Center',
   'لوحة تفاعلية تغطّي دورة حياة الابتكار من الفكرة إلى الأثر.',
   'An interactive dashboard covering the innovation lifecycle from idea to impact.'),
  ('reports_center_charts_section',
   'المؤشرات البيانية', 'Visual Indicators',
   'ثمانية رسوم بيانية تلخّص أداء المنصّة.',
   'Eight charts summarising platform performance.'),
  ('kpi_total_ideas', 'إجمالي الأفكار', 'Total Ideas', null, null),
  ('kpi_approved', 'الأفكار المعتمدة', 'Approved Ideas', null, null),
  ('kpi_avg_score', 'متوسط درجة التقييم', 'Average Evaluation Score', null, null),
  ('kpi_committee_decisions', 'قرارات اللجنة', 'Committee Decisions', null, null),
  ('chart_a_ideas_by_status',
   'الأفكار حسب الحالة', 'Ideas by Status',
   'توزيع الأفكار على مراحل الحالة الحالية.',
   'Distribution of ideas across their current status.'),
  ('chart_b_submissions_timeline',
   'الأفكار المقدَّمة عبر الزمن', 'Ideas Submitted Over Time',
   'عدد الأفكار المقدَّمة شهريًّا.',
   'Monthly count of submitted ideas.'),
  ('chart_c_approval_funnel',
   'مسار الاعتماد', 'Approval Rate Funnel',
   'من التقديم إلى الفرز والتقييم واللجنة والاعتماد.',
   'From submitted through screened, evaluated, committee, to approved.'),
  ('chart_d_ideas_by_theme',
   'الأفكار حسب المحور الاستراتيجي', 'Ideas by Strategic Theme',
   'عدد الأفكار المرتبطة بكل محور استراتيجي.',
   'Number of ideas mapped to each strategic theme.'),
  ('chart_e_score_distribution',
   'توزيع درجات التقييم', 'Evaluation Score Distribution',
   'متوسط الدرجة الكلّية موزّعًا على فئات من 0 إلى 10.',
   'Average total score bucketed from 0 to 10.'),
  ('chart_f_time_to_decision',
   'زمن اتخاذ القرار', 'Time-to-Decision',
   'متوسّط الأيام في كل مرحلة حتى القرار.',
   'Average days per stage until a decision.'),
  ('chart_g_top_innovators',
   'أبرز المبتكرين', 'Top Innovators',
   'أعلى عشرة مقدّمين حسب عدد الأفكار المعتمدة.',
   'Top ten submitters by approved idea count.'),
  ('chart_h_committee_trend',
   'اتجاه قرارات اللجنة', 'Committee Decisions Trend',
   'قرارات القبول والرفض شهريًّا.',
   'Approve and reject decisions per month.')
on conflict (key) do nothing;
