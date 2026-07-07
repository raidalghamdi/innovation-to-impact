import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createInvitations, sendInvitationEmail, type RoleCode } from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/invitations/send
 * Body: {
 *   role: RoleCode,
 *   targets: Array<{ email, name?, user_id? }>,
 *   deadline_at?: ISO date,
 *   locale?: 'ar'|'en',
 * }
 * Creates + sends invitations. Admin-only.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role as RoleCode | undefined;
  const targets = Array.isArray(body?.targets) ? body.targets : [];
  const locale = (body?.locale === 'en' ? 'en' : 'ar') as 'ar' | 'en';
  const deadline_at = body?.deadline_at ?? null;

  if (!role || targets.length === 0) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  try {
    const invitations = await createInvitations({
      role,
      targets: targets.map((t: any) => ({
        email: String(t.email ?? '').trim().toLowerCase(),
        name: t.name ? String(t.name) : undefined,
        user_id: t.user_id ?? null,
      })).filter((t: any) => t.email),
      deadline_at,
      sent_by: user.id,
    });

    const results = [];
    for (const inv of invitations) {
      const r = await sendInvitationEmail(inv, { locale, kind: 'invite' });
      results.push({ id: inv.id, email: inv.target_email, ...r });
    }

    return NextResponse.json({
      created: invitations.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/invitations/send
 * Body: { ids: string[], action: 'withdraw' }
 * Bulk-withdraw invitations (status → 'withdrawn'). Admin-only.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const action = String(body?.action ?? '');

  if (ids.length === 0 || action !== 'withdraw') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data, error } = await admin
    .schema('innovation')
    .from('invitations')
    .update({ status: 'withdrawn' })
    .in('id', ids)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ updated: data?.length ?? 0 });
}
