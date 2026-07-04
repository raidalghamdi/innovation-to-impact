'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/user';
import {
  acknowledgeEscalation,
  bumpEscalation,
  resolveEscalation,
} from '@/lib/escalations';

export type EscalationActionResult = { ok: boolean; error?: string };

async function requireReviewer(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };
  if (user.role !== 'admin' && user.role !== 'judge') return { ok: false, error: 'forbidden' };
  return { ok: true, userId: user.id };
}

export async function ackEscalationAction(
  id: string,
  note?: string
): Promise<EscalationActionResult> {
  const auth = await requireReviewer();
  if (!auth.ok) return { ok: false, error: auth.error };
  const ok = await acknowledgeEscalation(id, note, { actorId: auth.userId });
  revalidatePath('/[locale]/admin/escalations', 'page');
  return { ok };
}

export async function bumpEscalationAction(id: string): Promise<EscalationActionResult> {
  const auth = await requireReviewer();
  if (!auth.ok) return { ok: false, error: auth.error };
  const ok = await bumpEscalation(id, { actorId: auth.userId });
  revalidatePath('/[locale]/admin/escalations', 'page');
  return { ok, error: ok ? undefined : 'at_top_level' };
}

export async function resolveEscalationAction(
  id: string,
  resolution?: string
): Promise<EscalationActionResult> {
  const auth = await requireReviewer();
  if (!auth.ok) return { ok: false, error: auth.error };
  const ok = await resolveEscalation(id, resolution, { actorId: auth.userId });
  revalidatePath('/[locale]/admin/escalations', 'page');
  return { ok };
}
