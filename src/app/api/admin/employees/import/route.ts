import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSetting } from '@/lib/invitations';
import {
  isValidEmail,
  isValidImportRole,
  EMPLOYEE_IMPORT_ROLES,
} from '@/lib/employee-import';

export const dynamic = 'force-dynamic';

// POST /api/admin/employees/import — src/app/api/admin/employees/import/route.ts:1
// Body: { rows: Array<{ full_name, email, role, department }> }.
// Admin OR supervisor (getCurrentUser promotes supervisor -> admin).
// Each valid row is written as a pending row in innovation.invitations
// (the same table the invite flow uses via createInvitations). The invitee's
// auth.users account is created lazily on first sign-in; department is kept in
// the invitation metadata so it can be applied to the profile on activation.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];
  const total = rows.length;
  if (total === 0) {
    return NextResponse.json({ error: 'no_rows', total: 0, imported: 0, skipped: 0, errors: [] }, { status: 400 });
  }

  const defaults = await getAdminSetting<{ expires_days: number }>('invitation_defaults');
  const expiresDays = defaults?.expires_days ?? 14;
  const deadline = new Date(Date.now() + expiresDays * 24 * 3600 * 1000).toISOString();

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; email?: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    // Row number matches the spreadsheet (header is row 1, first data row is 2).
    const rowNum = i + 2;
    const r = rows[i];
    const fullName = String(r.full_name ?? '').trim();
    const email = String(r.email ?? '').trim().toLowerCase();
    const role = String(r.role ?? '').trim().toLowerCase();
    const department = String(r.department ?? '').trim();

    if (!fullName) {
      skipped++;
      errors.push({ row: rowNum, email, message: 'full_name is required' });
      continue;
    }
    if (!isValidEmail(email)) {
      skipped++;
      errors.push({ row: rowNum, email, message: 'Invalid email' });
      continue;
    }
    if (!isValidImportRole(role)) {
      skipped++;
      errors.push({ row: rowNum, email, message: `Invalid role (allowed: ${EMPLOYEE_IMPORT_ROLES.join(', ')})` });
      continue;
    }

    // Skip if a non-terminal invitation already exists for this email+role.
    const { data: existing } = await admin
      .from('invitations')
      .select('id, status')
      .eq('target_email', email)
      .eq('role', role)
      .in('status', ['pending', 'sent', 'viewed', 'accepted'])
      .maybeSingle();

    if (existing?.id) {
      skipped++;
      errors.push({ row: rowNum, email, message: 'Invitation already exists for this email + role' });
      continue;
    }

    const { error: insErr } = await admin.from('invitations').insert({
      role,
      target_email: email,
      target_name: fullName,
      deadline_at: deadline,
      sent_by: user.id,
      status: 'pending',
      metadata: { department: department || null, source: 'employee_import' },
    });

    if (insErr) {
      skipped++;
      errors.push({ row: rowNum, email, message: insErr.message });
      continue;
    }
    imported++;
  }

  return NextResponse.json({ total, imported, skipped, errors });
}
