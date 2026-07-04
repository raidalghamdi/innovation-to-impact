import { createClient } from '@/lib/supabase/server';

// Phase P — audit log wrapper. Best-effort: never throws so it cannot break the
// primary action it is instrumenting. Writes to innovation.audit_logs; if that
// table is unavailable the call is silently ignored.
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
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      after_state: changes ?? null,
    });
  } catch {
    // swallow — auditing must never break the underlying operation
  }
}

/**
 * Log an API request to innovation.audit_logs. Mirrors logAction's fire-and-
 * forget contract: never throws. Used by the API gateway wrapper so every
 * gateway-mediated call leaves a trace with endpoint + user + response status.
 *
 * The event is written with:
 *   action      = `api.<method>` (e.g. api.get)
 *   entity_type = 'api_request'
 *   entity_id   = the request-id (also returned to the caller via X-Request-Id)
 *   after_state = { endpoint, status, requestId }
 */
export async function logRequest(
  endpoint: string,
  userId: string | null,
  status: number,
  requestId: string,
  method: string = 'GET'
): Promise<void> {
  try {
    const supabase = await createClient();
    if (!supabase) return;
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      action: `api.${method.toLowerCase()}`,
      entity_type: 'api_request',
      entity_id: requestId,
      after_state: { endpoint, status, requestId },
    });
  } catch {
    // swallow — request logging must never break the caller
  }
}
