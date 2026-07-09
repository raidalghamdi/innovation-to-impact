import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { sendMail, renderMailHtml } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/mailer-test
 * Body: { to: string, subject?: string, body?: string, locale?: 'ar'|'en' }
 * Admin-only. Sends directly via the mailer WITHOUT touching the invitations
 * table. Returns the FULL provider error on failure so the admin can see e.g.
 * an unverified-domain message verbatim.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  if (!to) {
    return NextResponse.json({ error: 'missing_to' }, { status: 400 });
  }

  const locale = (body?.locale === 'en' ? 'en' : 'ar') as 'ar' | 'en';
  const subject =
    typeof body?.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : locale === 'ar'
        ? 'اختبار إرسال البريد'
        : 'Mailer test';
  const text =
    typeof body?.body === 'string' && body.body.trim()
      ? body.body.trim()
      : locale === 'ar'
        ? 'هذه رسالة اختبار من برنامج ابتكار المنافسة.'
        : 'This is a test message from Innovation to Impact.';

  const result = await sendMail({
    to,
    subject,
    text,
    html: renderMailHtml({ subject, body: text, locale }),
  });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      response_id: result.messageId ?? null,
    });
  }

  return NextResponse.json(
    { ok: false, provider: result.provider, error: result.error ?? 'send_failed' },
    { status: 502 }
  );
}
