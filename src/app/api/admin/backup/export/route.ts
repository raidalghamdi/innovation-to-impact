import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_TABLES, sheetNameFor } from '@/lib/backup';

export const dynamic = 'force-dynamic';

// POST /api/admin/backup/export
// Body: { password: string }
//
// Full-database Excel export — one sheet per table under innovation schema.
// Requires the caller to re-authenticate with their admin password so a stolen
// session alone cannot exfiltrate the whole DB. Password verification uses
// Supabase auth's signInWithPassword against the caller's own email; on
// success we return the Excel file, on failure a 401.
//
// The service-role client (createAdminClient) is used to read every table
// bypassing RLS — that's intentional and gated by both the admin-role check
// and the password re-auth. Never expose this endpoint to non-admins.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? '');
  if (!password) {
    return NextResponse.json({ error: 'password_required' }, { status: 400 });
  }

  // Re-authenticate with the caller's email + provided password. We use a
  // fresh SSR client so the password check is independent of the current
  // session's tokens.
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const { data: sessionUser } = await supabase.auth.getUser();
  const email = sessionUser?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // Build the workbook: one sheet per table. We fetch each table in full,
  // page-by-page in 1000-row chunks so we don't blow past PostgREST's default
  // limit for tables with thousands of rows (e.g. audit_logs).
  const workbook = XLSX.utils.book_new();
  const summary: { table: string; rows: number; error?: string }[] = [];
  const PAGE_SIZE = 1000;

  for (const table of BACKUP_TABLES) {
    try {
      const allRows: Record<string, unknown>[] = [];
      let from = 0;
      // Cap at 250k rows per table to protect the response — well beyond
      // what any healthy audit_logs table should carry in a single backup.
      const HARD_CAP = 250_000;
      // Loop pages until we get a short page (fewer than PAGE_SIZE rows).
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await admin
          .from(table)
          .select('*')
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          summary.push({ table, rows: 0, error: error.message });
          break;
        }
        const chunk = data ?? [];
        allRows.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (allRows.length >= HARD_CAP) break;
      }

      // Serialize any nested JSON values so Excel shows readable strings
      // instead of "[object Object]". Dates stay as ISO strings.
      const flat = allRows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v === null || v === undefined) {
            out[k] = '';
          } else if (typeof v === 'object' && !(v instanceof Date)) {
            out[k] = JSON.stringify(v);
          } else {
            out[k] = v;
          }
        }
        return out;
      });

      const sheet =
        flat.length > 0
          ? XLSX.utils.json_to_sheet(flat)
          : XLSX.utils.aoa_to_sheet([['(empty)']]);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetNameFor(table));
      summary.push({ table, rows: allRows.length });
    } catch (e: any) {
      summary.push({ table, rows: 0, error: e?.message ?? 'unknown_error' });
    }
  }

  // Prepend a metadata sheet so the recipient can tell when + who + what.
  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Innovation to Impact — Full DB Backup'],
    [''],
    ['Exported at', new Date().toISOString()],
    ['Exported by', email],
    ['Schema', 'innovation'],
    ['Tables', BACKUP_TABLES.length],
    [''],
    ['Table', 'Rows', 'Status'],
    ...summary.map((s) => [s.table, s.rows, s.error ? `ERROR: ${s.error}` : 'OK']),
  ]);
  // Move meta to the front by rebuilding SheetNames.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, metaSheet, '_backup_meta');
  for (const name of workbook.SheetNames) {
    XLSX.utils.book_append_sheet(wb, workbook.Sheets[name], name);
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  // Audit trail — best-effort, never blocks the download.
  try {
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin.backup.export',
      entity_type: 'database',
      entity_id: null,
      metadata: {
        tables: BACKUP_TABLES.length,
        total_rows: summary.reduce((sum, s) => sum + s.rows, 0),
      },
    });
  } catch {
    // audit failures should never break the primary action
  }

  const filename = `i2i-full-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
  // Wrap Buffer in Uint8Array so NextResponse's BodyInit type accepts it.
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
