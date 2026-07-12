import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { sendMail } from '@/lib/mailer';
import { logAudit } from '@/lib/audit';
import {
  getExportGenerator,
  isExportFormat,
  reportTitleFor,
  type ExportContext,
} from '@/lib/exports/registry';
import {
  assertRecipientAllowed,
  RecipientNotAllowedError,
} from '@/lib/exports/policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/exports/send-email — src/app/api/exports/send-email/route.ts:1
// Generates a screen's export and emails it as an attachment. Recipient policy
// is enforced server-side (see src/lib/exports/policy.ts): sensitive screens
// may only be sent to the requester; all others to the requester or any
// @gac.gov.sa address. Delivery goes through the shared mailer, which also logs
// the attempt to innovation.email_log. Every send is audited as export.email.
//
// Body: {
//   screenId: string, format: 'pdf'|'pptx'|'xlsx', recipient?: string,
//   filters?: Record<string,string|number|undefined>,
//   subject?: string, body?: string
// }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const screenId = typeof body?.screenId === 'string' ? body.screenId : '';
  const format = typeof body?.format === 'string' ? body.format : '';
  if (!screenId || !isExportFormat(format)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const filters =
    body?.filters && typeof body.filters === 'object' ? body.filters : {};

  // Resolve recipient. An empty value (or the 'self' sentinel) means "email it
  // to me" — always allowed and the only option for sensitive screens.
  const senderEmail = (user.email ?? '').trim();
  const requested = typeof body?.recipient === 'string' ? body.recipient.trim() : '';
  const recipient = !requested || requested.toLowerCase() === 'self' ? senderEmail : requested;

  if (!recipient) {
    return NextResponse.json({ error: 'no_recipient' }, { status: 400 });
  }

  try {
    assertRecipientAllowed({ screenId, senderEmail, recipient });
  } catch (err) {
    if (err instanceof RecipientNotAllowedError) {
      return NextResponse.json({ error: 'forbidden_recipient', reason: err.reason }, { status: 403 });
    }
    throw err;
  }

  const generator = getExportGenerator(screenId);
  if (!generator) {
    return NextResponse.json({ error: 'no_generator_for_screen', screenId }, { status: 501 });
  }

  const ctx: ExportContext = {
    format,
    filters,
    user: { id: user.id, email: user.email, role: user.role },
  };

  let artifact;
  try {
    artifact = await generator(ctx);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[exports] generator failed for ${screenId}/${format}:`, err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  const reportTitle = reportTitleFor(screenId);
  const date = new Date().toISOString().slice(0, 10);
  const subject =
    (typeof body?.subject === 'string' && body.subject.trim()) ||
    `[GAC I2I] ${reportTitle} — ${date}`;
  const messageBody =
    (typeof body?.body === 'string' && body.body.trim()) ||
    `${reportTitle} — ${date}`;
  const escaped = messageBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const result = await sendMail({
    to: recipient,
    subject,
    text: messageBody,
    html: `<p style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:14px;color:#28251D;">${escaped}</p>`,
    attachments: [
      {
        filename: artifact.filename,
        content: artifact.buffer,
        contentType: artifact.contentType,
      },
    ],
    relatedEntity: { type: 'export', id: screenId },
  });

  await logAudit(user.id, 'export.email', 'export', screenId, {
    after: { format, recipient, ok: result.ok, provider: result.provider },
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'send_failed', detail: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, recipient });
}
