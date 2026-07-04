'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { openSlaTracker, closeSlaTracker } from '@/lib/sla';

export type AssignmentResult = { ok: boolean; error?: string; count?: number };

const VALID_STATUSES = ['pending', 'completed', 'declined'];

type CreateInput = {
  ideaId: string;
  evaluatorId: string;
  dueAt?: string | null;
  notes?: string | null;
};

type UpdatePatch = {
  status?: string;
  dueAt?: string | null;
  notes?: string | null;
  evaluatorId?: string;
};

// Admin guard shared by every action. Returns the Supabase client + acting user
// or an error result the caller can return directly.
async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: 'not_configured' as const };
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'forbidden' as const };
  return { supabase, user };
}

export async function createAssignment(input: CreateInput): Promise<AssignmentResult> {
  if (!input.ideaId || !input.evaluatorId) return { ok: false, error: 'missing_fields' };

  const ctx = await requireAdmin();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { supabase, user } = ctx;

  const row = {
    idea_id: input.ideaId,
    evaluator_id: input.evaluatorId,
    assigned_by: user.id,
    due_at: input.dueAt || null,
    notes: input.notes || null,
    status: 'pending',
  };

  const { data, error } = await supabase.from('assignments').insert(row).select('id').single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[createAssignment] insert error:', error);
    return { ok: false, error: error.message };
  }

  const assignmentId = (data?.id as string) ?? null;
  await logAudit(user.id, 'assignment.created', 'assignment', assignmentId, {
    after: { idea_id: input.ideaId, evaluator_id: input.evaluatorId, due_at: input.dueAt || null, status: 'pending' },
  });

  // Notify the assignee (in-app + email) and open the evaluation SLA tracker.
  // Both helpers are best-effort and never throw.
  await createNotification(input.evaluatorId, 'evaluation_assigned', { ideaId: input.ideaId }, { email: true });
  if (assignmentId) await openSlaTracker('evaluation', assignmentId, null, 'pending');

  revalidatePath(`/[locale]/admin/assignments`, 'page');
  return { ok: true, count: 1 };
}

export async function bulkCreateAssignments(assignments: CreateInput[]): Promise<AssignmentResult> {
  const valid = assignments.filter((a) => a.ideaId && a.evaluatorId);
  if (!valid.length) return { ok: false, error: 'missing_fields' };

  const ctx = await requireAdmin();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { supabase, user } = ctx;

  const rows = valid.map((a) => ({
    idea_id: a.ideaId,
    evaluator_id: a.evaluatorId,
    assigned_by: user.id,
    due_at: a.dueAt || null,
    notes: a.notes || null,
    status: 'pending',
  }));

  const { data, error } = await supabase.from('assignments').insert(rows).select('id');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[bulkCreateAssignments] insert error:', error);
    return { ok: false, error: error.message };
  }

  const created = (data ?? []) as Array<{ id: string }>;
  await Promise.all(
    created.map((d, i) =>
      logAudit(user.id, 'assignment.created', 'assignment', d.id ?? null, {
        after: { idea_id: valid[i]?.ideaId, evaluator_id: valid[i]?.evaluatorId, status: 'pending' },
      })
    )
  );

  // Notify each assignee + open an SLA tracker per created row.
  await Promise.all(
    created.map((d, i) =>
      Promise.all([
        createNotification(valid[i]!.evaluatorId, 'evaluation_assigned', { ideaId: valid[i]!.ideaId }, { email: true }),
        d.id ? openSlaTracker('evaluation', d.id, null, 'pending') : Promise.resolve(),
      ])
    )
  );

  revalidatePath(`/[locale]/admin/assignments`, 'page');
  return { ok: true, count: rows.length };
}

export async function updateAssignment(id: string, patch: UpdatePatch): Promise<AssignmentResult> {
  if (!id) return { ok: false, error: 'missing_id' };
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return { ok: false, error: 'invalid_status' };

  const ctx = await requireAdmin();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { supabase, user } = ctx;

  const { data: prior } = await supabase
    .from('assignments')
    .select('status, due_at, notes, evaluator_id')
    .eq('id', id)
    .maybeSingle();

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt || null;
  if (patch.notes !== undefined) update.notes = patch.notes || null;
  if (patch.evaluatorId !== undefined) update.evaluator_id = patch.evaluatorId;
  if (Object.keys(update).length === 0) return { ok: true, count: 0 };

  const { error } = await supabase.from('assignments').update(update).eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[updateAssignment] update error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'assignment.updated', 'assignment', id, {
    before: (prior as Record<string, unknown> | null) ?? null,
    after: update,
  });

  // A completed evaluation resolves its SLA tracker; a reassignment notifies the
  // new assignee (in-app + email). Both helpers are best-effort.
  if (patch.status === 'completed') await closeSlaTracker('evaluation', id, true);
  if (patch.evaluatorId) {
    await createNotification(patch.evaluatorId, 'evaluation_assigned', { assignmentId: id }, { email: true });
  }

  revalidatePath(`/[locale]/admin/assignments`, 'page');
  return { ok: true, count: 1 };
}

// Soft delete: an "unassignment" sets status='declined' rather than removing
// the row, preserving the audit/SLA history.
export async function deleteAssignment(id: string): Promise<AssignmentResult> {
  return updateAssignment(id, { status: 'declined' });
}

export async function bulkDeleteAssignments(ids: string[]): Promise<AssignmentResult> {
  const clean = ids.filter(Boolean);
  if (!clean.length) return { ok: false, error: 'missing_id' };

  const ctx = await requireAdmin();
  if ('error' in ctx) return { ok: false, error: ctx.error };
  const { supabase, user } = ctx;

  const { data: prior } = await supabase
    .from('assignments')
    .select('id, status')
    .in('id', clean);

  const { error } = await supabase.from('assignments').update({ status: 'declined' }).in('id', clean);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[bulkDeleteAssignments] update error:', error);
    return { ok: false, error: error.message };
  }

  const priorById = new Map<string, Record<string, unknown>>();
  for (const p of prior ?? []) priorById.set(p.id as string, p as Record<string, unknown>);
  await Promise.all(
    clean.map((id) =>
      logAudit(user.id, 'assignment.unassigned', 'assignment', id, {
        before: priorById.get(id) ?? null,
        after: { status: 'declined' },
      })
    )
  );

  // Resolve the SLA tracker for each unassigned item.
  await Promise.all(clean.map((id) => closeSlaTracker('evaluation', id, true)));

  revalidatePath(`/[locale]/admin/assignments`, 'page');
  return { ok: true, count: clean.length };
}
