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
    name_en: 'Executive Performance Overview',
    desc_ar: 'ملخص تنفيذي للقيادة العليا: حجم الأفكار، معدل الاعتماد، والأثر المتوقع خلال الفترة.',
    desc_en: 'Board-ready summary: idea volume, approval rate, and projected value for the period.',
  },
  detailed: {
    name_ar: 'التقرير التفصيلي الشامل',
    name_en: 'Comprehensive Detailed Report',
    desc_ar: 'استعراض كامل على مستوى السجل لجميع الأفكار المُقدَّمة، مع بيانات الفريق والحالة.',
    desc_en: 'Record-level review of all submitted ideas, including team composition and current status.',
  },
  media: {
    name_ar: 'تقرير الإعلام والاتصال المؤسسي',
    name_en: 'Media & Corporate Communications Report',
    desc_ar: 'ملخص جاهز للنشر يبرز أبرز القصص، الاقتباسات المعتمدة، والمؤشرات الرئيسية.',
    desc_en: 'Publication-ready brief highlighting featured stories, approved quotations, and headline metrics.',
  },
  cx: {
    name_ar: 'تقرير تجربة المُبتكِر',
    name_en: 'Innovator Experience Report',
    desc_ar: 'مؤشرات رضا المستفيدين، أزمنة الاستجابة، وتحليل صوت المُبتكِر.',
    desc_en: 'Satisfaction indicators, response times, and voice-of-innovator analysis.',
  },
  operational: {
    name_ar: 'التقرير التشغيلي',
    name_en: 'Operational Performance Report',
    desc_ar: 'مؤشرات الأداء التشغيلي: أحمال العمل، الالتزام باتفاقيات مستوى الخدمة، وسلامة الإسناد.',
    desc_en: 'Operational KPIs: workload distribution, SLA compliance, and assignment integrity.',
  },
  audit: {
    name_ar: 'تقرير المراجعة والامتثال',
    name_en: 'Audit & Compliance Report',
    desc_ar: 'سجل موثَّق للعمليات والقرارات الجوهرية لأغراض المراجعة الداخلية والامتثال.',
    desc_en: 'Documented trail of material operations and decisions for internal audit and compliance.',
  },
  ideas: {
    name_ar: 'سجل الأفكار',
    name_en: 'Ideas Register',
    desc_ar: 'سجل رسمي لكل فكرة مُقدَّمة يتضمن البيانات التعريفية والحالة الراهنة.',
    desc_en: 'Formal register of every submitted idea with core metadata and current status.',
  },
  evaluators: {
    name_ar: 'تقرير أداء المُقيّمين',
    name_en: 'Evaluator Performance Report',
    desc_ar: 'إنتاجية هيئة التقييم، متوسط الدرجات المُسندة، ومتوسط زمن الاستجابة.',
    desc_en: 'Evaluator productivity, average awarded scores, and mean response time.',
  },
  themes: {
    name_ar: 'تقرير المسارات الاستراتيجية',
    name_en: 'Strategic Themes Report',
    desc_ar: 'أداء كل مسار استراتيجي: حجم المقترحات، معدل الاعتماد، والأثر المُحقَّق.',
    desc_en: 'Performance by strategic track: submission volume, adoption rate, and realized impact.',
  },
  innovators: {
    name_ar: 'تقرير المُبتكِرين',
    name_en: 'Innovators Report',
    desc_ar: 'حصر رسمي للمُبتكِرين المشاركين، مساهماتهم، وترتيبهم على مستوى المنصة.',
    desc_en: 'Official roster of participating innovators, their contributions, and platform ranking.',
  },
  committee: {
    name_ar: 'تقرير قرارات اللجنة',
    name_en: 'Committee Decisions Report',
    desc_ar: 'محاضر اجتماعات اللجنة، القرارات الصادرة، وسجل النِصاب.',
    desc_en: 'Committee meeting minutes, formal resolutions, and quorum records.',
  },
  trends: {
    name_ar: 'تقرير الاتجاهات والتحليل الزمني',
    name_en: 'Trends & Time-Series Analysis',
    desc_ar: 'التحليل الزمني للأداء: نمو الأفكار، انتقال المراحل، والمؤشرات الشهرية.',
    desc_en: 'Time-series analysis of performance: idea growth, stage progression, and monthly indicators.',
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
