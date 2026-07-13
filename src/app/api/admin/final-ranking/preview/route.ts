import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { previewFinalRanking } from '@/lib/lifecycle-transitions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/final-ranking/preview
 *
 * Admin-only dry run of T4. Returns which ideas WOULD be approved vs
 * not_selected (with ranks) using the same ordering as run_final_ranking().
 * Writes nothing.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const { wouldApprove, wouldNotSelect, topN } = await previewFinalRanking();
    return NextResponse.json({
      ok: true,
      topN,
      wouldApproveCount: wouldApprove.length,
      wouldNotSelectCount: wouldNotSelect.length,
      wouldApprove,
      wouldNotSelect,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'preview_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
