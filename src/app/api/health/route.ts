import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

/**
 * GET /api/health
 *
 * Unauthenticated liveness probe. Returns a small JSON payload uptime
 * monitors (Vercel, UptimeRobot, StatusCake, k8s liveness probes, etc.)
 * can hit safely. Deliberately does NOT touch Supabase — a green health
 * check means the Next.js runtime is up, not that downstream dependencies
 * are reachable. If you need dependency-aware readiness, add a separate
 * `/api/ready` that does a `select 1` against Supabase.
 *
 * Contract:
 *   { status: "ok", version: string, timestamp: string }
 *
 * `status` is always "ok" for successful responses. `version` reads from
 * package.json at build time. `timestamp` is server-wall-clock ISO-8601.
 */

// Never cache — must reflect current server time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: pkg.version ?? '0.0.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
