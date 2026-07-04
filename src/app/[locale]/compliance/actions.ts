'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';

export type UpdateControlResult = { ok: boolean; error?: string };

const VALID_STATUSES = ['not_started', 'in_progress', 'met', 'not_applicable'];

type UpdateInput = {
  id: string;
  status: string;
  lastReviewedAt: string | null;
};

// Admin-only: update a compliance control's status + last_reviewed_at. Records
// the before/after transition to the audit trail.
export async function updateControlStatus(input: UpdateInput): Promise<UpdateControlResult> {
  if (!VALID_STATUSES.includes(input.status)) return { ok: false, error: 'invalid_status' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { ok: false, error: 'forbidden' };

  const { data: prior } = await supabase
    .from('compliance_controls')
    .select('status, last_reviewed_at')
    .eq('id', input.id)
    .maybeSingle();

  const { error } = await supabase
    .from('compliance_controls')
    .update({ status: input.status, last_reviewed_at: input.lastReviewedAt })
    .eq('id', input.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[updateControlStatus] supabase error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'compliance.status_updated', 'compliance_control', input.id, {
    before: prior ?? null,
    after: { status: input.status, last_reviewed_at: input.lastReviewedAt },
  });

  revalidatePath(`/[locale]/compliance`, 'page');
  return { ok: true };
}
