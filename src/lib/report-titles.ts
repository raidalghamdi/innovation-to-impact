// Client-safe title helpers for the admin Reports Center. Kept separate from
// reports-charts.ts (which imports the server-only Supabase client) so client
// components can pull `pickTitle` / defaults without dragging next/headers into
// the browser bundle.

export type ReportTitle = {
  key: string;
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
};

// Hardcoded fallbacks — used when a row is absent or Supabase is unconfigured.
// Keys mirror sql_pending/04_report_titles.sql exactly.
export const TITLE_DEFAULTS: Record<string, ReportTitle> = {
  reports_center_hero: {
    key: 'reports_center_hero',
    title_ar: 'مركز التقارير التحليلية',
    title_en: 'Analytics Reports Center',
    subtitle_ar: 'لوحة تفاعلية تغطّي دورة حياة الابتكار من الفكرة إلى الأثر.',
    subtitle_en: 'An interactive dashboard covering the innovation lifecycle from idea to impact.',
  },
  reports_center_charts_section: {
    key: 'reports_center_charts_section',
    title_ar: 'المؤشرات البيانية',
    title_en: 'Visual Indicators',
    subtitle_ar: 'ثمانية رسوم بيانية تلخّص أداء المنصّة.',
    subtitle_en: 'Eight charts summarising platform performance.',
  },
  chart_a_ideas_by_status: {
    key: 'chart_a_ideas_by_status',
    title_ar: 'الأفكار حسب الحالة',
    title_en: 'Ideas by Status',
    subtitle_ar: 'توزيع الأفكار على مراحل الحالة الحالية.',
    subtitle_en: 'Distribution of ideas across their current status.',
  },
  chart_b_submissions_timeline: {
    key: 'chart_b_submissions_timeline',
    title_ar: 'الأفكار المقدَّمة عبر الزمن',
    title_en: 'Ideas Submitted Over Time',
    subtitle_ar: 'عدد الأفكار المقدَّمة شهريًّا.',
    subtitle_en: 'Monthly count of submitted ideas.',
  },
  chart_c_approval_funnel: {
    key: 'chart_c_approval_funnel',
    title_ar: 'مسار الاعتماد',
    title_en: 'Approval Rate Funnel',
    subtitle_ar: 'من التقديم إلى الفرز والتقييم واللجنة والاعتماد.',
    subtitle_en: 'From submitted through screened, evaluated, committee, to approved.',
  },
  chart_d_ideas_by_theme: {
    key: 'chart_d_ideas_by_theme',
    title_ar: 'الأفكار حسب المحور الاستراتيجي',
    title_en: 'Ideas by Strategic Theme',
    subtitle_ar: 'عدد الأفكار المرتبطة بكل محور استراتيجي.',
    subtitle_en: 'Number of ideas mapped to each strategic theme.',
  },
  chart_e_score_distribution: {
    key: 'chart_e_score_distribution',
    title_ar: 'توزيع درجات التقييم',
    title_en: 'Evaluation Score Distribution',
    subtitle_ar: 'متوسط الدرجة الكلّية موزّعًا على فئات من 0 إلى 10.',
    subtitle_en: 'Average total score bucketed from 0 to 10.',
  },
  chart_f_time_to_decision: {
    key: 'chart_f_time_to_decision',
    title_ar: 'زمن اتخاذ القرار',
    title_en: 'Time-to-Decision',
    subtitle_ar: 'متوسّط الأيام في كل مرحلة حتى القرار.',
    subtitle_en: 'Average days per stage until a decision.',
  },
  chart_g_top_innovators: {
    key: 'chart_g_top_innovators',
    title_ar: 'أبرز المبتكرين',
    title_en: 'Top Innovators',
    subtitle_ar: 'أعلى عشرة مقدّمين حسب عدد الأفكار المعتمدة.',
    subtitle_en: 'Top ten submitters by approved idea count.',
  },
  chart_h_committee_trend: {
    key: 'chart_h_committee_trend',
    title_ar: 'اتجاه قرارات اللجنة',
    title_en: 'Committee Decisions Trend',
    subtitle_ar: 'قرارات القبول والرفض شهريًّا.',
    subtitle_en: 'Approve and reject decisions per month.',
  },
};

// Locale-aware picker for a title/subtitle, falling back across locales.
export function pickTitle(t: ReportTitle | undefined, locale: string): { title: string; subtitle: string } {
  const isAr = locale === 'ar';
  return {
    title: (isAr ? t?.title_ar : t?.title_en) || t?.title_en || t?.title_ar || '',
    subtitle: (isAr ? t?.subtitle_ar : t?.subtitle_en) || t?.subtitle_en || t?.subtitle_ar || '',
  };
}
