// Reports catalog — the 12 report types the admin can generate, plus the
// shape every report shares. Reports are ad-hoc: an admin picks a type,
// a date range, a format (pdf/xlsx/pptx) and a delivery method (download
// or email). Everything below is stable metadata used by both the API
// and the UI so the two never disagree.

export type ReportType =
  | 'executive'
  | 'detailed'
  | 'media'
  | 'cx'
  | 'operational'
  | 'audit'
  | 'ideas'
  | 'evaluators'
  | 'themes'
  | 'innovators'
  | 'committee'
  | 'trends';

export type ReportFormat = 'pdf' | 'xlsx' | 'pptx';
export type ReportDelivery = 'download' | 'email';

export type ReportRequest = {
  type: ReportType;
  format: ReportFormat;
  delivery: ReportDelivery;
  from?: string; // yyyy-mm-dd (inclusive)
  to?: string; // yyyy-mm-dd (inclusive)
  themeId?: string;
  recipients?: string[]; // required when delivery=email
  locale?: 'ar' | 'en';
};

// Localised names + short one-line descriptions used by the /admin/reports
// picker. Keeps strings out of components so the whole picker stays declarative.
export const REPORT_META: Record<
  ReportType,
  { name_ar: string; name_en: string; desc_ar: string; desc_en: string }
> = {
  executive: {
    name_ar: 'التقرير التنفيذي',
    name_en: 'Executive Report',
    desc_ar: 'مؤشرات عليا للقيادة: أعداد الأفكار، معدلات القبول، القيمة المتوقعة.',
    desc_en: 'Top-level KPIs for leadership: idea volume, approval rate, expected value.',
  },
  detailed: {
    name_ar: 'التقرير التفصيلي',
    name_en: 'Detailed Report',
    desc_ar: 'قائمة تفصيلية بجميع الأفكار مع الحقول والفريق والحالة.',
    desc_en: 'Row-level breakdown of every idea, team, and status.',
  },
  media: {
    name_ar: 'تقرير الإعلام والتواصل',
    name_en: 'Media & Communications Report',
    desc_ar: 'ملخص جاهز للنشر: القصص البارزة، الاقتباسات، والأرقام الأثرية.',
    desc_en: 'Publication-ready summary: highlight stories, quotes, and headline numbers.',
  },
  cx: {
    name_ar: 'تقرير تجربة المستخدم',
    name_en: 'Customer Experience Report',
    desc_ar: 'رضا المستفيدين، معدلات الاستجابة، وصوت العميل.',
    desc_en: 'User satisfaction, response times, and voice-of-innovator signals.',
  },
  operational: {
    name_ar: 'التقرير التشغيلي',
    name_en: 'Operational Report',
    desc_ar: 'مؤشرات التشغيل اليومي: طوابير العمل، اتفاقيات الخدمة، الإسناد.',
    desc_en: 'Daily-ops signals: work queues, SLA compliance, assignment health.',
  },
  audit: {
    name_ar: 'تقرير المراجعة والامتثال',
    name_en: 'Audit & Compliance Report',
    desc_ar: 'سجل العمليات والقرارات الحساسة للمراجعين والامتثال.',
    desc_en: 'Full trail of sensitive operations and decisions for auditors.',
  },
  ideas: {
    name_ar: 'تقرير الأفكار',
    name_en: 'Ideas Report',
    desc_ar: 'كل فكرة مع بياناتها الأساسية وحالتها.',
    desc_en: 'Every idea with core metadata and current status.',
  },
  evaluators: {
    name_ar: 'تقرير المُقيّمين',
    name_en: 'Evaluators Report',
    desc_ar: 'إنتاجية المُقيّمين، متوسط الدرجات، ووقت الاستجابة.',
    desc_en: 'Evaluator productivity, average scores, and response time.',
  },
  themes: {
    name_ar: 'تقرير المسارات الاستراتيجية',
    name_en: 'Strategic Themes Report',
    desc_ar: 'أداء كل مسار: أعداد الأفكار، معدل الاعتماد، الأثر.',
    desc_en: 'Per-track performance: idea volume, adoption rate, impact.',
  },
  innovators: {
    name_ar: 'تقرير المبتكرين',
    name_en: 'Innovators Report',
    desc_ar: 'قائمة المبتكرين ومساهماتهم وترتيبهم.',
    desc_en: 'Innovator roster with contribution and ranking.',
  },
  committee: {
    name_ar: 'تقرير قرارات اللجنة',
    name_en: 'Committee Decisions Report',
    desc_ar: 'قرارات اللجنة والاجتماعات والنِصاب.',
    desc_en: 'Committee decisions, meetings, and quorum records.',
  },
  trends: {
    name_ar: 'تقرير الاتجاهات',
    name_en: 'Trends Report',
    desc_ar: 'اتجاهات زمنية: نمو الأفكار، تحوّل المراحل، الأداء الشهري.',
    desc_en: 'Time-series trends: idea growth, stage flow, monthly performance.',
  },
};

export const ALL_REPORT_TYPES: ReportType[] = Object.keys(REPORT_META) as ReportType[];

// Row-and-columns bag: every report — regardless of format — is ultimately
// a list of tabular sections plus a header. This intermediate representation
// keeps queries decoupled from renderers.
export type ReportSection = {
  title_ar: string;
  title_en: string;
  columns: Array<{ key: string; label_ar: string; label_en: string; width?: number }>;
  rows: Record<string, string | number | null>[];
};

export type ReportKpi = {
  label_ar: string;
  label_en: string;
  value: string;
};

export type ReportBundle = {
  type: ReportType;
  generatedAt: string; // ISO
  generatedBy: string;
  dateFrom: string | null;
  dateTo: string | null;
  kpis: ReportKpi[];
  sections: ReportSection[];
  totalRowCount: number;
};
