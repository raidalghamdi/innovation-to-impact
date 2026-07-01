import { createClient } from '@/lib/supabase/server';

// Phase P — audit log wrapper. Best-effort: never throws so it cannot break the
// primary action it is instrumenting. Writes to public.audit_log (migration
// 00004); if that table is unavailable the call is silently ignored.
export async function logAction(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  changes?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    if (!supabase) return;
    await supabase.from('audit_log').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: changes ?? null,
    });
  } catch {
    // swallow — auditing must never break the underlying operation
  }
}
