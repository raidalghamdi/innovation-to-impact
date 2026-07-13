// Central definition of the idea lifecycle statuses (R43 full state machine).
// Single source of truth for the innovation.idea_status vocabulary and its
// bilingual display labels. Consumed by dashboards to render a status badge
// without re-deriving copy.
//
// Spec (sec. 3-4, /home/user/workspace/r42_later_item6_spec.md):
//   - `evaluation_failed` displays as "لم تتجاوز التقييم / Did Not Pass
//     Evaluation" (never "Failed").
//   - `not_selected` displays as "لم تُعتمد / Not Selected" — distinct from
//     evaluation_failed (which never reached the committee).
//   - Other statuses keep their existing labels.
//
// This is distinct from src/lib/lifecycle.ts (the legacy lifecycle_status
// transition guard from superseded migration 00004). This file describes the
// live idea_status enum.

export type StatusLabel = { ar: string; en: string };

// Every idea_status enum value (00001 + 00020 withdrawn + 00031 R43 additions)
// mapped to its bilingual label.
export const IDEA_STATUSES: Record<string, StatusLabel> = {
  // --- Early / intake ---
  draft: { ar: 'مسودة', en: 'Draft' },
  submitted: { ar: 'مقدَّمة', en: 'Submitted' },
  screening: { ar: 'الفرز الأولي', en: 'Screening' },
  needs_completion: { ar: 'بحاجة لاستكمال', en: 'Needs Completion' },
  returned: { ar: 'معادة للتعديل', en: 'Returned' },
  // --- Evaluation ---
  evaluation: { ar: 'قيد التقييم', en: 'Under Evaluation' },
  pass_awaiting_attachments: {
    ar: 'بانتظار المرفقات النهائية',
    en: 'Awaiting Final Attachments',
  },
  // --- Committee / ranking ---
  committee: { ar: 'مراجعة اللجنة', en: 'Committee Review' },
  pending_final_ranking: {
    ar: 'بانتظار الفرز النهائي',
    en: 'Pending Final Ranking',
  },
  assigned: { ar: 'مُسندة', en: 'Assigned' },
  // --- Post-program (manual, admin only) ---
  in_pilot: { ar: 'التنفيذ التجريبي', en: 'In Pilot' },
  in_measurement: { ar: 'القياس والأثر', en: 'Measurement & Impact' },
  in_scaling: { ar: 'التوسّع والاعتماد', en: 'Scaling & Adoption' },
  in_implementation: { ar: 'قيد التنفيذ', en: 'In Implementation' },
  benefits_tracking: { ar: 'تتبّع المنافع', en: 'Benefits Tracking' },
  closed: { ar: 'مغلقة', en: 'Closed' },
  // --- Terminal ---
  withdrawn: { ar: 'مسحوبة', en: 'Withdrawn' },
  rejected: { ar: 'مرفوضة', en: 'Rejected' },
  evaluation_failed: { ar: 'لم تتجاوز التقييم', en: 'Did Not Pass Evaluation' },
  approved: { ar: 'معتمدة', en: 'Approved' },
  not_selected: { ar: 'لم تُعتمد', en: 'Not Selected' },
  archived: { ar: 'مؤرشفة', en: 'Archived' },
};

export type IdeaStatus = keyof typeof IDEA_STATUSES;

// Terminal states — no further transition (spec sec. 3).
export const TERMINAL_STATUSES = [
  'withdrawn',
  'rejected',
  'evaluation_failed',
  'approved',
  'not_selected',
  'closed',
  'archived',
] as const;

// Non-terminal / in-flight states (spec sec. 4).
export const INTERMEDIATE_STATUSES = [
  'draft',
  'submitted',
  'screening',
  'needs_completion',
  'returned',
  'evaluation',
  'pass_awaiting_attachments',
  'committee',
  'pending_final_ranking',
  'assigned',
  'in_pilot',
  'in_measurement',
  'in_scaling',
  'in_implementation',
  'benefits_tracking',
] as const;

export function getStatusLabel(status: string, locale: string): string {
  const label = IDEA_STATUSES[status];
  if (!label) return status;
  return locale === 'ar' ? label.ar : label.en;
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
