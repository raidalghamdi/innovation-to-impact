import { NextRequest, NextResponse } from 'next/server';
import { maybeRunWeeklyBriefing } from '@/lib/weekly-briefing';

// Vercel Cron (see vercel.json). On Hobby plan we're capped at one cron job
// per day, so the actual weekly logic is normally triggered in-process from
// /api/cron/sla-reminders (which runs daily and gates the briefing to
// Mondays via maybeRunWeeklyBriefing). This route exists as a directly
// callable/testable entry point for the same logic, secured the same way as
// /api/cron/sla-reminders: caller must send `authorization: Bearer <CRON_SECRET>`.
//
// All metric-gathering, rendering, and send logic lives in
// `@/lib/weekly-briefing` — Next.js route handler files may only export HTTP
// method functions (GET/POST/...) plus a small allowlist of config fields, so
// none of that logic can live here directly.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // `?force=true` bypasses the Monday gate for manual testing/verification.
  const force = req.nextUrl.searchParams.get('force') === 'true';
  const result = await maybeRunWeeklyBriefing({ force });
  if (!result.ran) {
    return NextResponse.json({ status: 'skipped', reason: 'not_monday_utc' });
  }
  return NextResponse.json({ status: 'ok', recipients: result.recipients, metrics: result.metrics });
}
