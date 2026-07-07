import { NextRequest, NextResponse } from 'next/server';
import { respondToInvitation } from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invitations/[token]/respond
 * Body: { decision: 'accepted'|'declined', note?, user_id? }
 * Public — token acts as authorization.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision as 'accepted' | 'declined' | undefined;
  const note = body?.note as string | undefined;
  const userId = body?.user_id as string | null | undefined;

  if (!token || (decision !== 'accepted' && decision !== 'declined')) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const result = await respondToInvitation(token, decision, note, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ invitation: result.invitation });
}

/**
 * GET /api/invitations/[token]/respond — fetch invitation by token for landing page.
 * Also marks as 'viewed' if currently 'sent'.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const { data } = await admin
    .schema('innovation')
    .from('invitations')
    .select('id, role, target_email, target_name, status, deadline_at, responded_at, response_note')
    .eq('token', token)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (data.status === 'sent') {
    await admin
      .schema('innovation')
      .from('invitations')
      .update({ status: 'viewed' })
      .eq('id', data.id);
    data.status = 'viewed';
  }
  return NextResponse.json({ invitation: data });
}
