'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';

export type SupportResult = { ok: boolean; error?: string };

// Mark a support message as handled by the acting admin. Sets handled_at=now()
// and handled_by=the current user. Admin-only; best-effort audit log.
export async function markSupportHandled(id: string): Promise<SupportResult> {
  if (!id) return { ok: false, error: 'missing_id' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { ok: false, error: 'forbidden' };

  const { error } = await supabase
    .from('support_messages')
    .update({ handled_at: new Date().toISOString(), handled_by: user.id })
    .eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[markSupportHandled] update error:', error);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'support_message.handled', 'support_message', id, {
    after: { handled_by: user.id },
  });

  revalidatePath('/[locale]/admin/support', 'page');
  return { ok: true };
}
