'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import {
  CR_STATES,
  assertCrTransition,
  type CrState,
  type CrResult,
  type CreateCrInput,
} from '@/lib/change-requests';

async function requireReviewer() {
  const supabase = await createClient();
  if (!supabase) return { error: 'not_configured' as const };
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'judge')) {
    return { error: 'forbidden' as const };
  }
  return { supabase, user };
}

// Move a change request to a new status. Validates the transition, stamps the
// reviewer/applied timestamps, and audit-logs the before/after.
export async function moveChangeRequest(id: string, to: CrState): Promise<CrResult> {
  if (!id) return { ok: false, error: 'missing_id' };
  if (!CR_STATES.includes(to)) return { ok: false, error: 'invalid_status' };

  const ctx = await requireReviewer();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { supabase, user } = ctx;

  const { data: prior } = await supabase
    .from('change_requests')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  const from = (prior as { status?: CrState } | null)?.status;
  if (!from) return { ok: false, error: 'not_found' };

  try {
    assertCrTransition(from, to);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: to };
  if (to === 'in_review' || to === 'approved' || to === 'rejected') {
    update.reviewed_by = user.id;
    update.reviewed_at = now;
  }
  if (to === 'applied') update.applied_at = now;

  const { error } = await supabase.from('change_requests').update(update).eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[moveChangeRequest] update error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'change_request.transition', 'change_request', id, {
    before: { status: from },
    after: { status: to },
  });

  revalidatePath(`/[locale]/admin/change-requests`, 'page');
  return { ok: true };
}

// Any authenticated user can propose a change; it lands in the `requested`
// column for reviewers to triage.
export async function createChangeRequest(input: CreateCrInput): Promise<CrResult> {
  if (!input.entityType || !input.entityId || !input.fieldPath) {
    return { ok: false, error: 'missing_fields' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data, error } = await supabase
    .from('change_requests')
    .insert({
      requested_by: user.id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      field_path: input.fieldPath,
      current_value: input.currentValue ?? null,
      proposed_value: input.proposedValue ?? null,
      reason_ar: input.reasonAr ?? null,
      reason_en: input.reasonEn ?? null,
      status: 'requested',
    })
    .select('id')
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[createChangeRequest] insert error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'change_request.created', 'change_request', (data?.id as string) ?? null, {
    after: { entity_type: input.entityType, field_path: input.fieldPath },
  });

  revalidatePath(`/[locale]/admin/change-requests`, 'page');
  return { ok: true };
}
