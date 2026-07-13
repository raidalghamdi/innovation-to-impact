import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { runFinalRanking } from '@/lib/lifecycle-transitions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/final-ranking/run  (Transition T4)
 *
 * Admin-only. Ranks every idea in `pending_final_ranking` per track; the top N
 * become `approved`, the rest `not_selected`. Returns the resulting counts.
 *
 * TODO(cron): once the evaluation window has a hard close, schedule this instead
 * of relying on a manual admin trigger.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const result = await runFinalRanking();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ranking_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
