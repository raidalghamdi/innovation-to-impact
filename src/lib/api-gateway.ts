/**
 * Innovation-to-Impact API Gateway
 * ---------------------------------
 * A thin wrapper that gives every server-side data access a consistent
 * shape: request ID, auth gate, request logging to innovation.audit_logs,
 * and standardized error envelopes.
 *
 * The gateway is *server-only* — do not import from client components. It
 * assumes it can await `createClient()` from `@/lib/supabase/server`, which
 * reads request cookies to determine the current user.
 *
 * Usage in a route handler:
 *
 *     import { withGateway } from '@/lib/api-gateway';
 *
 *     export const GET = withGateway(
 *       async ({ supabase, userId, requestId }) => {
 *         const { data, error } = await supabase
 *           .from('ideas')
 *           .select('id,title')
 *           .eq('owner_id', userId);
 *         if (error) throw error;
 *         return { ideas: data };
 *       },
 *       { endpoint: '/api/ideas', requireAuth: true }
 *     );
 *
 * Every response — success or failure — carries `X-Request-Id`. Errors
 * follow the { error, code, requestId } contract.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logRequest } from '@/lib/audit';

// ---------- Types ----------------------------------------------------------

/** Standard error envelope returned by every gateway-mediated endpoint. */
export interface ApiErrorBody {
  error: string;
  code: string;
  requestId: string;
}

/** Context handed to gateway handlers. */
export interface GatewayContext {
  /** Live Supabase client bound to the innovation schema. May be `null` when Supabase is not configured. */
  supabase: SupabaseClient | null;
  /** Authenticated user id, or `null` when the endpoint does not require auth. */
  userId: string | null;
  /** Unique id for this request. Echoed to the client via the `X-Request-Id` response header. */
  requestId: string;
  /** The raw `NextRequest` for handlers that need URL params, headers, etc. */
  request: NextRequest;
}

export interface GatewayOptions {
  /** Endpoint label written to the audit log. Defaults to `request.nextUrl.pathname`. */
  endpoint?: string;
  /** When true (default) the gateway rejects unauthenticated requests with 401. */
  requireAuth?: boolean;
}

/**
 * Thrown by a handler (or the gateway itself) to short-circuit a response
 * with a specific HTTP status + error code. The gateway catches these,
 * formats the envelope and writes the audit log entry.
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ---------- Helpers --------------------------------------------------------

/**
 * Generate a request id. Prefers `crypto.randomUUID()` (available in the
 * Node/Edge runtimes Next.js uses); falls back to a timestamp+random hex
 * string on ancient runtimes.
 */
function newRequestId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Serialize the standard error envelope + set X-Request-Id header. */
function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): NextResponse<ApiErrorBody> {
  const res = NextResponse.json<ApiErrorBody>(
    { error: message, code, requestId },
    { status },
  );
  res.headers.set('X-Request-Id', requestId);
  return res;
}

// ---------- Public: withGateway --------------------------------------------

/**
 * Wraps an async handler with: request-id issuance, auth gate, Supabase
 * client injection, structured error handling, and audit logging.
 *
 * The handler may return either a plain JSON-serialisable value (which the
 * gateway wraps in `NextResponse.json(...)` with status 200) or a
 * `NextResponse` for full control.
 */
export function withGateway<T>(
  handler: (ctx: GatewayContext) => Promise<T | NextResponse>,
  options: GatewayOptions = {},
) {
  const { endpoint: staticEndpoint, requireAuth = true } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId =
      request.headers.get('x-request-id') || newRequestId();
    const endpoint = staticEndpoint ?? request.nextUrl.pathname;
    const method = request.method || 'GET';

    let userId: string | null = null;
    let responseStatus = 200;
    let response: NextResponse;

    try {
      const supabase = await createClient();

      // Auth check: enforced before any data query.
      if (requireAuth) {
        if (!supabase) {
          throw new ApiError(
            503,
            'SUPABASE_UNCONFIGURED',
            'Data backend is not configured for this environment.',
          );
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          throw new ApiError(
            401,
            'UNAUTHENTICATED',
            'Authentication required.',
          );
        }
        userId = data.user.id;
      } else if (supabase) {
        // Best-effort: capture user id when present, but do not gate.
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
      }

      const result = await handler({
        supabase,
        userId,
        requestId,
        request,
      });

      if (result instanceof NextResponse) {
        response = result;
        responseStatus = response.status;
      } else {
        response = NextResponse.json(result ?? {}, { status: 200 });
        responseStatus = 200;
      }
      response.headers.set('X-Request-Id', requestId);
    } catch (err) {
      if (err instanceof ApiError) {
        response = errorResponse(err.status, err.code, err.message, requestId);
        responseStatus = err.status;
      } else {
        // Unknown / unexpected failure. Do NOT leak internal details.
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        // eslint-disable-next-line no-console
        console.error(`[api-gateway] ${endpoint} ${requestId}:`, message);
        response = errorResponse(
          500,
          'INTERNAL_ERROR',
          'An unexpected error occurred. Please try again.',
          requestId,
        );
        responseStatus = 500;
      }
    }

    // Fire-and-forget audit log. `logRequest` is best-effort — it swallows
    // its own errors so a failed audit write never masks the real response.
    void logRequest(endpoint, userId, responseStatus, requestId, method);

    return response;
  };
}
