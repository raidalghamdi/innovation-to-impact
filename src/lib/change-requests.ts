// Change-request state machine (WS7 F4). Extracted from
// src/app/[locale]/admin/change-requests/actions.ts because Next.js server-
// action files ("use server") may only export async functions. Constants,
// types, and pure predicates live here.

export const CR_STATES = ['requested', 'in_review', 'approved', 'rejected', 'applied'] as const;
export type CrState = (typeof CR_STATES)[number];

export const CR_TRANSITIONS: Record<CrState, CrState[]> = {
  requested: ['in_review', 'rejected'],
  in_review: ['approved', 'rejected', 'requested'],
  approved: ['applied', 'rejected'],
  rejected: [],
  applied: [],
};

export function canCrTransition(from: CrState, to: CrState): boolean {
  return CR_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCrTransition(from: CrState, to: CrState): void {
  if (!canCrTransition(from, to)) {
    throw new Error(`Illegal change-request transition: "${from}" → "${to}".`);
  }
}

export type CrResult = { ok: boolean; error?: string };

export type CreateCrInput = {
  entityType: string;
  entityId: string;
  fieldPath: string;
  currentValue: unknown;
  proposedValue: unknown;
  reasonAr?: string | null;
  reasonEn?: string | null;
};
