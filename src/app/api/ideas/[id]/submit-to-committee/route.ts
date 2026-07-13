import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { fanOut } from '@/lib/notifications';
import { enqueueEmail, renderBilingualEmailHtml } from '@/lib/email-outbox';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ideas/[id]/submit-to-committee  (Transition T2)
 *
 * The innovator, after their idea passed evaluation, uploads the mandatory
 * post-pass attachments and then submits the idea to the committee.
 *
 * Server-side gate (defense in depth):
 *  1) Caller must be the idea's submitter (or admin).
 *  2) Idea must be in `pass_awaiting_attachments`.
 *  3) At least one live `post_pass` evidence attachment must exist.
 *  4) On success: status → `committee` (idempotent guard). Committee members are
 *     notified in-app + by bilingual email. Best-effort — notification errors
 *     never fail the transition.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('id, code, submitter_id, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  if (!idea) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = idea as {
    id: string;
    code: string | null;
    submitter_id: string | null;
    status: string | null;
  };

  if (row.submitter_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (row.status !== 'pass_awaiting_attachments') {
    return NextResponse.json(
      { error: 'invalid_state', current: row.status },
      { status: 409 }
    );
  }

  // Mandatory post-pass attachment gate.
  const { count: attachmentCount, error: attErr } = await supabase
    .from('evidence_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', id)
    .eq('attachment_type', 'post_pass')
    .is('deleted_at', null);
  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 400 });

  if (!attachmentCount || attachmentCount < 1) {
    return NextResponse.json(
      {
        error: 'attachments_required',
        message_ar: 'يجب إرفاق المستندات الداعمة قبل الإحالة إلى اللجنة.',
        message_en: 'You must upload the supporting attachments before submitting to the committee.',
      },
      { status: 400 }
    );
  }

  // Idempotent transition — only flips a row still in pass_awaiting_attachments.
  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from('ideas')
    .update({ status: 'committee', updated_at: now })
    .eq('id', id)
    .eq('status', 'pass_awaiting_attachments')
    .select('id');
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  if (!updated || updated.length === 0) {
    // Lost the race — someone/something already advanced it.
    return NextResponse.json({ error: 'invalid_state', current: row.status }, { status: 409 });
  }

  // Notify committee members (judge/committee roles) — in-app + bilingual email.
  // Best-effort; never fail the transition on a notification error.
  try {
    const { data: memberRows } = await supabase
      .from('v_user_roles')
      .select('user_id')
      .in('role_code', ['judge', 'committee'])
      .eq('role_active', true);
    const memberIds = Array.from(
      new Set(
        ((memberRows as { user_id: string }[] | null) ?? [])
          .map((r) => r.user_id)
          .filter(Boolean)
      )
    );
    if (memberIds.length) {
      const ideaCode = row.code ?? id;
      const link = `/committee`;
      await fanOut(memberIds, 'approval_requested', { ideaId: id, ideaCode }, { link });

      // Bilingual email to each committee member (durable outbox).
      const html = renderBilingualEmailHtml({
        titleAr: 'فكرة جاهزة لمراجعة اللجنة',
        titleEn: 'An idea is ready for committee review',
        bodyHtmlAr: `الفكرة <strong>${ideaCode}</strong> اجتازت التقييم واكتملت مرفقاتها، وهي الآن بانتظار قرار اللجنة.`,
        bodyHtmlEn: `Idea <strong>${ideaCode}</strong> passed evaluation, its attachments are complete, and it now awaits the committee's decision.`,
        ctaHref: link,
        ctaLabelAr: 'فتح قائمة اللجنة',
        ctaLabelEn: 'Open committee queue',
      });
      const { data: contacts } = await supabase
        .from('user_profiles')
        .select('email')
        .in('id', memberIds);
      const emails = ((contacts as { email: string | null }[] | null) ?? [])
        .map((c) => c.email)
        .filter((e): e is string => Boolean(e));
      await Promise.all(
        emails.map((to) =>
          enqueueEmail({
            to,
            subject: 'فكرة جاهزة لمراجعة اللجنة / Idea ready for committee review',
            bodyHtml: html,
            category: 'idea_status',
          })
        )
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[submit-to-committee] notify failed:', e);
  }

  return NextResponse.json({ ok: true, status: 'committee' });
}
