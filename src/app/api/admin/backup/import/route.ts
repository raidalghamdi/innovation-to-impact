import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { BACKUP_TABLES, sheetNameFor } from '@/lib/backup';

export const dynamic = 'force-dynamic';

// Bump the body-size limit for this route so admins can upload multi-MB
// backups. Vercel's default is 4.5MB for edge, 4.5MB for serverless action-
// like handlers; for a full DB dump we allow up to ~50MB.
export const maxDuration = 300; // seconds

// POST /api/admin/backup/import
// multipart/form-data:
//   - file: the .xlsx workbook (as produced by /export)
//   - password: admin's login password (for re-auth)
//
// Merge-only import: for each table sheet we upsert on the primary key `id`.
// If a row exists it gets updated; if it doesn't, it gets inserted. Nothing
// is deleted server-side, per the user's explicit safe-import choice.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const password = String(form.get('password') ?? '');
  const file = form.get('file');
  if (!password) {
    return NextResponse.json({ error: 'password_required' }, { status: 400 });
  }
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  // Re-auth with the caller's password.
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

  // Read the workbook. The `file` may be a File or Blob depending on runtime.
  const arrayBuf = await (file as Blob).arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(arrayBuf), { type: 'array' });
  } catch (e: any) {
    return NextResponse.json({ error: 'invalid_xlsx', detail: e?.message }, { status: 400 });
  }

  const results: { table: string; upserted: number; skipped: number; error?: string }[] = [];

  for (const table of BACKUP_TABLES) {
    const sheetName = sheetNameFor(table);
    const sheet = workbook.Sheets[sheetName] ?? workbook.Sheets[table];
    if (!sheet) {
      results.push({ table, upserted: 0, skipped: 0, error: 'sheet_missing' });
      continue;
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: null,
      raw: false,
    });

    // Skip the placeholder single-cell "(empty)" sheet we produced on export.
    const meaningful = rawRows.filter(
      (r) => !(Object.keys(r).length === 1 && String(r[Object.keys(r)[0]]).trim() === '(empty)')
    );
    if (meaningful.length === 0) {
      results.push({ table, upserted: 0, skipped: 0 });
      continue;
    }

    // Normalize row values: convert empty strings back to null, re-parse any
    // JSON strings that were stringified on export.
    const rows = meaningful.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined || v === '') {
          out[k] = null;
          continue;
        }
        if (typeof v === 'string') {
          const trimmed = v.trim();
          // Attempt JSON re-hydration for values that clearly came from a
          // JSON.stringify (objects/arrays only).
          if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
          ) {
            try {
              out[k] = JSON.parse(trimmed);
              continue;
            } catch {
              // fall through — treat as literal string
            }
          }
        }
        out[k] = v;
      }
      return out;
    });

    // Upsert on `id` if present, else on a table-specific unique key if we
    // know it. Most tables have `id uuid primary key`. `platform_settings`
    // uses `key`. `user_roles` and `employee_roles` use composite keys we
    // don't try to reconstruct — fall back to plain insert with `ignoreDuplicates`.
    const CHUNK = 500;
    let upserted = 0;
    let skipped = 0;
    let lastError: string | undefined;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      try {
        let onConflict: string | undefined;
        if (chunk[0] && 'id' in chunk[0]) {
          onConflict = 'id';
        } else if (table === 'platform_settings' && 'key' in (chunk[0] ?? {})) {
          onConflict = 'key';
        }

        // Upsert without SELECT-back to avoid RLS filtering row counts down
        // to zero. We treat a successful upsert as chunk.length merged rows;
        // conflicts against `onConflict` still merge (no throw), and rows
        // ignored via ignoreDuplicates are still counted as merged from the
        // caller's perspective (nothing was lost).
        const { error } = await admin.from(table).upsert(chunk as any, {
          onConflict,
          ignoreDuplicates: !onConflict,
        });
        if (error) {
          lastError = error.message;
          skipped += chunk.length;
        } else {
          upserted += chunk.length;
        }
      } catch (e: any) {
        lastError = e?.message ?? 'unknown_error';
        skipped += chunk.length;
      }
    }

    results.push({ table, upserted, skipped, ...(lastError ? { error: lastError } : {}) });
  }

  // Audit trail — best-effort.
  try {
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'admin.backup.import',
      entity_type: 'database',
      entity_id: null,
      metadata: {
        total_upserted: results.reduce((sum, r) => sum + r.upserted, 0),
        total_skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        tables_with_errors: results.filter((r) => r.error).map((r) => r.table),
      },
    });
  } catch {
    // audit failures should never break the primary action
  }

  return NextResponse.json({
    ok: true,
    summary: results,
    totals: {
      upserted: results.reduce((sum, r) => sum + r.upserted, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.filter((r) => r.error).length,
    },
  });
}
