import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { ANALYTICS_ROLES } from '@/lib/roles';
import { getScope } from '@/lib/scope';
import { fetchExecutiveSummary } from '@/lib/data';
import { logAudit } from '@/lib/audit';

// One payload for the executive view: KPIs (with prior period + sparkline
// series), pillar breakdown, lifecycle funnel, and recent committee decisions.
// Admin + judge only; results are scope-narrowed (a judge sees only their
// assigned themes). Cached for 5 minutes.
export const revalidate = 300;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !ANALYTICS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const scope = await getScope();
  const summary = await fetchExecutiveSummary(scope);

  // Best-effort audit — must never block the response.
  await logAudit(user.id, 'analytics.executive_summary.read', 'analytics', null, {
    after: { role: scope.role, themes: scope.allowedThemes?.length ?? 'all' },
  });

  return NextResponse.json(summary);
}
