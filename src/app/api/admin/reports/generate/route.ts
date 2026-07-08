// POST /api/admin/reports/generate
//
// Admin-only. Body:
//   { type, format, delivery, from?, to?, themeId?, recipients?, locale? }
//
// delivery='download' → responds with the file bytes (Content-Disposition attachment).
// delivery='email'    → emails the file to `recipients[]` via Resend, responds 200 JSON.
// Every call inserts a row into `innovation.report_generations` for audit.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReport } from '@/lib/reports';
import type { ReportRequest, ReportType, ReportFormat, ReportDelivery } from '@/lib/reports';
import { ALL_REPORT_TYPES, REPORT_META } from '@/lib/reports';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // generation + email can take a bit

const FORMATS: ReportFormat[] = ['pdf', 'xlsx', 'pptx'];
const DELIVERIES: ReportDelivery[] = ['download', 'email'];

function isType(x: unknown): x is ReportType {
  return typeof x === 'string' && (ALL_REPORT_TYPES as string[]).includes(x);
}
function isFormat(x: unknown): x is ReportFormat {
  return typeof x === 'string' && (FORMATS as string[]).includes(x);
}
function isDelivery(x: unknown): x is ReportDelivery {
  return typeof x === 'string' && (DELIVERIES as string[]).includes(x);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (!isType(body.type)) return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  if (!isFormat(body.format)) return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  if (!isDelivery(body.delivery)) return NextResponse.json({ error: 'invalid_delivery' }, { status: 400 });

  const from = typeof body.from === 'string' ? body.from : undefined;
  const to = typeof body.to === 'string' ? body.to : undefined;
  const themeId = typeof body.themeId === 'string' ? body.themeId : undefined;
  const locale: 'ar' | 'en' = body.locale === 'ar' ? 'ar' : 'en';
  const recipients = Array.isArray(body.recipients)
    ? (body.recipients as unknown[]).filter((r): r is string => typeof r === 'string' && r.includes('@'))
    : [];

  if (body.delivery === 'email' && recipients.length === 0) {
    return NextResponse.json({ error: 'recipients_required' }, { status: 400 });
  }

  const reportReq: ReportRequest = {
    type: body.type,
    format: body.format,
    delivery: body.delivery,
    from,
    to,
    themeId,
    recipients,
    locale,
  };

  // Admin client for audit inserts (service-role) — RLS-friendly for the
  // admin table, but this lets the write succeed even if the request comes
  // from a background job later.
  const admin = createAdminClient();
  const generatedBy = user.email || user.id;

  const startedAt = Date.now();
  const displayName = user.email || user.id;

  // Insert a pending audit row.
  let auditId: string | null = null;
  if (admin) {
    const { data: audit, error: auditErr } = await admin
      .from('report_generations')
      .insert({
        report_type: reportReq.type,
        format: reportReq.format,
        filters: { themeId: themeId ?? null, locale },
        date_from: from ? `${from}T00:00:00Z` : null,
        date_to: to ? `${to}T23:59:59Z` : null,
        generated_by: user.id,
        delivery: reportReq.delivery,
        recipients: reportReq.delivery === 'email' ? recipients : null,
        status: 'pending',
      })
      .select('id')
      .maybeSingle();
    if (!auditErr && audit) auditId = (audit as { id: string }).id;
  }

  try {
    const artifact = await generateReport(reportReq, displayName);
    const duration = Date.now() - startedAt;

    // Audit success (best effort).
    if (admin && auditId) {
      await admin
        .from('report_generations')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          file_name: artifact.fileName,
          file_size_bytes: artifact.bytes.byteLength,
          row_count: artifact.bundle.totalRowCount,
          duration_ms: duration,
        })
        .eq('id', auditId);
    }

    if (reportReq.delivery === 'email') {
      const meta = REPORT_META[reportReq.type];
      const rangeLabel =
        from || to ? `${from ?? '…'} → ${to ?? '…'}` : locale === 'ar' ? 'كل الفترات' : 'All time';
      const subject =
        locale === 'ar'
          ? `${meta.name_ar} — ${rangeLabel}`
          : `${meta.name_en} — ${rangeLabel}`;
      const bodyHtml = `
        <div style="font-family:Arial,sans-serif;color:#28251D">
          <h2 style="color:#01696F;margin:0 0 12px">${locale === 'ar' ? meta.name_ar : meta.name_en}</h2>
          <p>${locale === 'ar' ? 'مرفق تقرير' : 'Attached is the report'}
             <strong>${locale === 'ar' ? meta.name_ar : meta.name_en}</strong>.</p>
          <p style="color:#7A7974;font-size:12px">${rangeLabel}</p>
          <p style="color:#7A7974;font-size:12px">
            ${locale === 'ar' ? 'أُنشئ بواسطة' : 'Generated by'}: ${displayName}
          </p>
        </div>
      `;
      const result = await sendMail({
        to: recipients,
        subject,
        html: bodyHtml,
        attachments: [
          {
            filename: artifact.fileName,
            content: Buffer.from(artifact.bytes),
            contentType: artifact.mimeType,
          },
        ],
      });

      if (!result.ok) {
        const reason = result.error ?? 'email_failed';
        if (admin && auditId) {
          await admin
            .from('report_generations')
            .update({ status: 'error', error_message: reason })
            .eq('id', auditId);
        }
        return NextResponse.json({ error: 'email_failed', reason }, { status: 502 });
      }

      return NextResponse.json({
        ok: true,
        delivery: 'email',
        recipients,
        fileName: artifact.fileName,
        rowCount: artifact.bundle.totalRowCount,
      });
    }

    // Download response.
    return new NextResponse(new Uint8Array(artifact.bytes), {
      status: 200,
      headers: {
        'Content-Type': artifact.mimeType,
        'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
        'Content-Length': String(artifact.bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[reports/generate] failed:', errMsg);
    if (admin && auditId) {
      await admin
        .from('report_generations')
        .update({
          status: 'error',
          error_message: errMsg.slice(0, 500),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq('id', auditId);
    }
    return NextResponse.json({ error: 'generation_failed', message: errMsg }, { status: 500 });
  }
}
