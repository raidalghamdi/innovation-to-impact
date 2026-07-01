import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, { ar: string; en: string; tone: string }> = {
  draft: { ar: 'مسودة', en: 'Draft', tone: 'slate' },
  submitted: { ar: 'مُقدّمة', en: 'Submitted', tone: 'blue' },
  screening: { ar: 'فرز', en: 'Screening', tone: 'blue' },
  needs_completion: { ar: 'تحتاج استكمال', en: 'Needs completion', tone: 'amber' },
  evaluation: { ar: 'تقييم', en: 'Evaluation', tone: 'blue' },
  committee: { ar: 'لجنة', en: 'Committee', tone: 'purple' },
  approved: { ar: 'معتمدة', en: 'Approved', tone: 'green' },
  rejected: { ar: 'مرفوضة', en: 'Rejected', tone: 'red' },
  returned: { ar: 'مُعادة', en: 'Returned', tone: 'amber' },
  assigned: { ar: 'مُسندة', en: 'Assigned', tone: 'teal' },
  in_pilot: { ar: 'قيد التجربة', en: 'In pilot', tone: 'teal' },
  in_implementation: { ar: 'قيد التنفيذ', en: 'In implementation', tone: 'teal' },
  benefits_tracking: { ar: 'تتبع المنافع', en: 'Benefits tracking', tone: 'green' },
  closed: { ar: 'مغلقة', en: 'Closed', tone: 'slate' },
  archived: { ar: 'مؤرشفة', en: 'Archived', tone: 'slate' },
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
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
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
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[meta.tone]
      )}
    >
      {locale === 'ar' ? meta.ar : meta.en}
    </span>
  );
}
