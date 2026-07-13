import { cn } from '@/lib/utils';
import { pick } from '@/lib/i18n-content';
import { getStatusLabel, IDEA_STATUSES } from '@/lib/lifecycle-states';

// Per-status tone. Terminal states have their own colors (spec sec. 3):
// withdrawn=gray, rejected=red, evaluation_failed=orange, approved=green,
// not_selected=amber. Intermediate lifecycle states keep their prior tones.
// Text labels are resolved via getStatusLabel (lifecycle-states.ts) so copy is
// centralized; only non-lifecycle values (compliance/generic) keep local text.
const STATUS_LABELS: Record<string, { ar: string; en: string; tone: string }> = {
  draft: { ar: 'مسودة', en: 'Draft', tone: 'slate' },
  submitted: { ar: 'مُقدّمة', en: 'Submitted', tone: 'blue' },
  screening: { ar: 'فرز', en: 'Screening', tone: 'blue' },
  under_screening: { ar: 'قيد الفرز', en: 'Under screening', tone: 'blue' },
  needs_completion: { ar: 'تحتاج استكمال', en: 'Needs completion', tone: 'amber' },
  evaluation: { ar: 'قيد التقييم', en: 'Under evaluation', tone: 'blue' },
  pass_awaiting_attachments: {
    ar: 'بانتظار المرفقات النهائية',
    en: 'Awaiting final attachments',
    tone: 'amber',
  },
  committee: { ar: 'لجنة', en: 'Committee', tone: 'purple' },
  pending_final_ranking: { ar: 'بانتظار الفرز النهائي', en: 'Pending final ranking', tone: 'purple' },
  approved: { ar: 'معتمدة', en: 'Approved', tone: 'green' },
  rejected: { ar: 'مرفوضة', en: 'Rejected', tone: 'red' },
  evaluation_failed: { ar: 'لم تتجاوز التقييم', en: 'Did not pass evaluation', tone: 'orange' },
  not_selected: { ar: 'لم تُعتمد', en: 'Not selected', tone: 'amber' },
  returned: { ar: 'مُعادة', en: 'Returned', tone: 'amber' },
  assigned: { ar: 'مُسندة', en: 'Assigned', tone: 'teal' },
  in_pilot: { ar: 'قيد التجربة', en: 'In pilot', tone: 'teal' },
  in_measurement: { ar: 'القياس والأثر', en: 'Measurement & impact', tone: 'teal' },
  in_scaling: { ar: 'التوسّع والاعتماد', en: 'Scaling & adoption', tone: 'teal' },
  in_implementation: { ar: 'قيد التنفيذ', en: 'In implementation', tone: 'teal' },
  benefits_tracking: { ar: 'تتبع المنافع', en: 'Benefits tracking', tone: 'green' },
  closed: { ar: 'مغلقة', en: 'Closed', tone: 'slate' },
  archived: { ar: 'مؤرشفة', en: 'Archived', tone: 'slate' },
  withdrawn: { ar: 'مسحوبة', en: 'Withdrawn', tone: 'gray' },
  // compliance
  compliant: { ar: 'ملتزم', en: 'Compliant', tone: 'green' },
  in_progress: { ar: 'قيد التنفيذ', en: 'In progress', tone: 'amber' },
  non_compliant: { ar: 'غير ملتزم', en: 'Non-compliant', tone: 'red' },
  // generic
  active: { ar: 'نشطة', en: 'Active', tone: 'green' },
  running: { ar: 'جارية', en: 'Running', tone: 'teal' },
  completed: { ar: 'مكتملة', en: 'Completed', tone: 'green' },
  planned: { ar: 'مخططة', en: 'Planned', tone: 'slate' },
  open: { ar: 'مفتوحة', en: 'Open', tone: 'blue' },
  pending: { ar: 'معلقة', en: 'Pending', tone: 'amber' },
};

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
  orange: 'bg-orange-50 text-orange-700',
  purple: 'bg-purple-50 text-purple-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  teal: 'bg-brand-teal-light text-brand-teal',
};

export function StatusBadge({
  status,
  locale,
}: {
  status: string;
  locale: string;
}) {
  const meta = STATUS_LABELS[status] ?? { ar: status, en: status, tone: 'slate' };
  // Lifecycle statuses draw their text from the single source of truth so copy
  // never drifts (e.g. evaluation_failed → "لم تتجاوز التقييم"). Non-lifecycle
  // values (compliance/generic) fall back to the local bilingual pair.
  const label = IDEA_STATUSES[status]
    ? getStatusLabel(status, locale)
    : pick(meta.ar, meta.en, locale);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[meta.tone]
      )}
    >
      {label}
    </span>
  );
}
