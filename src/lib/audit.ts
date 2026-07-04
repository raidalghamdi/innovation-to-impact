import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type AuditStates = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  // Optional privileged client for session-less callers (cron / fan-out jobs),
  // mirroring the `client` option on notifications.ts's createNotification.
  // Falls back to the RLS-scoped session client when omitted.
  client?: SupabaseClient<any, any, any>;
};

// Universal audit-log wrapper. Best-effort: never throws so it cannot break the
// primary action it is instrumenting. Writes to innovation.audit_logs; if that
// table is unavailable the call is silently ignored. Pass `states.before` to
// capture the pre-change snapshot and `states.after` for the post-change value.
export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  states?: AuditStates
): Promise<void> {
  try {
    const supabase = states?.client ?? (await createClient());
    if (!supabase) return;
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_state: states?.before ?? null,
      after_state: states?.after ?? null,
    });
  } catch {
    // swallow — auditing must never break the underlying operation
  }
}

/**
 * @deprecated Use {@link logAudit} instead. Retained so existing callers keep
 * working; forwards the legacy `changes` argument as the `after` state.
 */
export async function logAction(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  changes?: Record<string, unknown>
): Promise<void> {
  return logAudit(actorId, action, entityType, entityId, { after: changes ?? null });
}

/**
 * Log an API request to innovation.audit_logs. Mirrors logAudit's fire-and-
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
  return logAudit(userId, `api.${method.toLowerCase()}`, 'api_request', requestId, {
    after: { endpoint, status, requestId },
  });
}

export type AuditChainResult = { ok: boolean; firstBreakSeq: number | null };

/**
 * Verify the tamper-evident audit hash chain by calling the
 * innovation.verify_audit_chain() RPC (see migration 00005). Returns whether
 * the chain is intact and, if not, the chain_seq of the first broken row.
 * Best-effort: returns { ok: true } when Supabase is unconfigured so previews
 * and builds don't fail.
 */
export async function verifyAuditChain(): Promise<AuditChainResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: true, firstBreakSeq: null };
    const { data, error } = await supabase.rpc('verify_audit_chain');
    if (error || !data) return { ok: true, firstBreakSeq: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: Boolean(row?.ok),
      firstBreakSeq: row?.first_break_seq ?? null,
    };
  } catch {
    return { ok: true, firstBreakSeq: null };
  }
}
