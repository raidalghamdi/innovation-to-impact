// Phase scheduling helpers. Admin sets start/end dates for each of the 7 phases
// from /admin/phases. Public pages use these to gate CTAs and show countdowns.
//
// Storage stays 0-based (idx 0..6). Display in UI is 1-based (Stage 1..7).

import { createClient } from '@/lib/supabase/server';

export type PhaseRow = {
  idx: number;
  code: string;
  label_ar: string;
  label_en: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

/**
 * Load all 7 phase rows in order. Safe against missing table: returns [] instead
 * of throwing so pages render before the migration is applied.
 */
export async function loadPhaseSchedule(): Promise<PhaseRow[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('phase_schedule')
      .select('idx,code,label_ar,label_en,starts_at,ends_at,updated_at')
      .order('idx', { ascending: true });
    if (error) {
      console.error('[loadPhaseSchedule]', error);
      return [];
    }
    return (data ?? []) as PhaseRow[];
  } catch (err) {
    console.error('[loadPhaseSchedule] threw:', err);
    return [];
  }
}

/**
 * Compute the currently-active phase based on start/end dates.
 * Returns -1 if the program has not started, 7 if it has ended,
 * or the idx (0..6) of the phase whose window contains now().
 */
export function getActivePhaseIndex(phases: PhaseRow[], now: Date = new Date()): number {
  if (!phases.length) return -1;
  const ts = now.getTime();
  for (const p of phases) {
    const s = p.starts_at ? new Date(p.starts_at).getTime() : null;
    const e = p.ends_at ? new Date(p.ends_at).getTime() : null;
    if (s !== null && ts < s) continue;
    if (e !== null && ts >= e) continue;
    if (s !== null || e !== null) return p.idx;
  }
  // no window matched: fall back to the last phase whose starts_at is in the past
  let last = -1;
  for (const p of phases) {
    const s = p.starts_at ? new Date(p.starts_at).getTime() : null;
    if (s !== null && s <= ts) last = Math.max(last, p.idx);
  }
  return last;
}

/**
 * Is idea submission still open? (phase 0 = submission)
 * Returns true if we're before starts_at + endsAt (i.e., within phase 0 window)
 * OR if phase 0 has no schedule set yet (default open).
 */
export function isSubmissionOpen(phases: PhaseRow[], now: Date = new Date()): boolean {
  const submission = phases.find((p) => p.idx === 0);
  if (!submission) return true; // no data yet — don't block users
  const ts = now.getTime();
  const s = submission.starts_at ? new Date(submission.starts_at).getTime() : null;
  const e = submission.ends_at ? new Date(submission.ends_at).getTime() : null;
  if (s !== null && ts < s) return false;
  if (e !== null && ts >= e) return false;
  return true;
}
