/**
 * R42-later — shared status grouping for the supervisor dashboard cards
 * (Item 9) and the /admin/all-ideas list (Item 10).
 *
 * The DB status enum is owned by the innovator agent and may use either the
 * legacy values (screening / evaluation / committee / assigned) or the newer
 * ones (under_screening / under_evaluation / under_committee). We match BOTH
 * so a card count stays correct regardless of which enum values are live.
 *
 * "Returned" is NOT a status — it is the `returned_to_innovator` boolean flag.
 * For backward compatibility we also treat a legacy status of 'returned' as
 * returned.
 */

export type SupervisorFilter =
  | 'all'
  | 'under_review'
  | 'approved'
  | 'returned'
  | 'rejected';

export const SUPERVISOR_FILTERS: SupervisorFilter[] = [
  'all',
  'under_review',
  'approved',
  'returned',
  'rejected',
];

// قيد الفحص — anything still moving through screening / evaluation / committee.
export const UNDER_REVIEW_STATUSES = new Set([
  'submitted',
  'screening',
  'under_screening',
  'evaluation',
  'under_evaluation',
  'committee',
  'under_committee',
  'assigned',
]);

export type FilterableIdea = {
  status: string | null;
  returned_to_innovator?: boolean | null;
};

export function isReturned(idea: FilterableIdea): boolean {
  return idea.returned_to_innovator === true || idea.status === 'returned';
}

export function isUnderReview(idea: FilterableIdea): boolean {
  // A returned idea is awaiting the innovator, not the supervisor — exclude it
  // from the "under review" bucket so the cards do not double-count.
  if (isReturned(idea)) return false;
  return UNDER_REVIEW_STATUSES.has(idea.status ?? '');
}

export function matchesFilter(idea: FilterableIdea, filter: SupervisorFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'under_review':
      return isUnderReview(idea);
    case 'approved':
      return idea.status === 'approved' && !isReturned(idea);
    case 'returned':
      return isReturned(idea);
    case 'rejected':
      return idea.status === 'rejected' && !isReturned(idea);
    default:
      return true;
  }
}

export function normalizeFilter(value: string | null | undefined): SupervisorFilter {
  return (SUPERVISOR_FILTERS as string[]).includes(value ?? '')
    ? (value as SupervisorFilter)
    : 'all';
}

export function filterLabel(filter: SupervisorFilter, isAr: boolean): string {
  switch (filter) {
    case 'under_review':
      return isAr ? 'قيد الفحص' : 'Under review';
    case 'approved':
      return isAr ? 'معتمدة' : 'Approved';
    case 'returned':
      return isAr ? 'معادة' : 'Returned';
    case 'rejected':
      return isAr ? 'مرفوضة' : 'Rejected';
    case 'all':
    default:
      return isAr ? 'إجمالي' : 'Total';
  }
}
