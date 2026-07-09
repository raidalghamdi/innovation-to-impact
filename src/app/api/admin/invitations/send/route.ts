import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import {
  createInvitations,
  sendInvitationEmail,
  getTemplateByCode,
  resolveProfileRecipients,
  sendTemplatedInvitations,
  type RoleCode,
  type TemplateRecipient,
} from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/invitations/send?role=expert  → preview recipients for a role
 * GET /api/admin/invitations/send?broadcast=1   → preview all active users
 * Admin-only. Used by the "Send now" modal to preview By-role / Everyone counts.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const broadcast = searchParams.get('broadcast') === '1';
  const role = searchParams.get('role') as RoleCode | null;
  const recipients = await resolveProfileRecipients(broadcast ? null : role);
  return NextResponse.json({ recipients, count: recipients.length });
}

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
  const locale = (body?.locale === 'en' ? 'en' : 'ar') as 'ar' | 'en';

  // --- Round 3: template-based direct send -----------------------------------
  if (body?.template_code) {
    const template = await getTemplateByCode(String(body.template_code));
    if (!template || !template.is_active) {
      return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
    }

    let recipients: TemplateRecipient[] = Array.isArray(body?.recipients)
      ? body.recipients
      : [];

    if (body?.broadcast === true) {
      if (!(template as any).is_broadcast) {
        return NextResponse.json({ error: 'template_not_broadcast' }, { status: 400 });
      }
      recipients = await resolveProfileRecipients(null);
    } else if (body?.send_to_all_role) {
      recipients = await resolveProfileRecipients(body.send_to_all_role as RoleCode);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'no_recipients' }, { status: 400 });
    }

    try {
      const result = await sendTemplatedInvitations({
        template,
        recipients,
        locale,
        campaign_id: body?.campaign_id ?? null,
        sent_by: user.id,
        subject_override: typeof body?.subject === 'string' ? body.subject : null,
        body_override: typeof body?.body === 'string' ? body.body : null,
        extra_info_title:
          typeof body?.extra_info_title === 'string' ? body.extra_info_title : null,
        extra_info_body:
          typeof body?.extra_info_body === 'string' ? body.extra_info_body : null,
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // --- Legacy role/targets flow ----------------------------------------------
  const role = body?.role as RoleCode | undefined;
  const targets = Array.isArray(body?.targets) ? body.targets : [];
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
