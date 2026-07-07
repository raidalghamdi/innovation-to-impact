import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendReminder } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/invitation-reminders
 *
 * Vercel cron endpoint. Reads admin_settings.reminder_schedule to decide:
 *   - enabled?           → bail if false
 *   - gap_hours          → skip invitations reminded within last N hours
 *   - stop_after_n_reminders → skip invitations that already hit the cap
 *
 * Iterates pending invitations (status IN sent/viewed) and sends reminders.
 *
 * Auth: bearer token via `CRON_SECRET` env (Vercel injects x-vercel-cron for
 * built-in scheduler; we also accept `?token=CRON_SECRET` for manual triggers).
 */
export async function GET(req: NextRequest) {
  // Auth: Vercel cron sends x-vercel-cron header. Manual triggers use CRON_SECRET.
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const tokenParam = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const authorized =
    isVercelCron ||
    (cronSecret && (tokenParam === cronSecret || bearer === cronSecret));

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  // Load reminder settings
  const { data: settingRow } = await admin
    .schema('innovation')
    .from('admin_settings')
    .select('value')
    .eq('key', 'reminder_schedule')
    .maybeSingle();
  const s = (settingRow?.value as any) ?? {};
  const enabled = s.enabled !== false;
  const gapHours = Number(s.gap_hours ?? 48);
  const maxReminders = Number(s.stop_after_n_reminders ?? 3);

  if (!enabled) {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  const nowIso = new Date().toISOString();
  const gapCutoff = new Date(Date.now() - gapHours * 3600 * 1000).toISOString();

  // Pull candidates (status in sent/viewed, under cap, past gap window)
  const { data: candidates, error } = await admin
    .schema('innovation')
    .from('invitations')
    .select('id, status, reminder_count, last_reminder_at, sent_at, deadline_at')
    .in('status', ['sent', 'viewed'])
    .lt('reminder_count', maxReminders);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible = (candidates ?? []).filter((row: any) => {
    // Skip if past deadline (expire it later? mark for now, don't remind)
    if (row.deadline_at && row.deadline_at < nowIso) return false;
    // Skip if reminded within gap
    if (row.last_reminder_at && row.last_reminder_at > gapCutoff) return false;
    return true;
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of eligible) {
    const r = await sendReminder(row.id);
    results.push({ id: row.id, ok: r.ok, error: r.ok ? undefined : (r as any).error });
  }

  // Also mark expired invitations
  await admin
    .schema('innovation')
    .from('invitations')
    .update({ status: 'expired' })
    .in('status', ['pending', 'sent', 'viewed'])
    .lt('deadline_at', nowIso);

  return NextResponse.json({
    ok: true,
    candidates: eligible.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
