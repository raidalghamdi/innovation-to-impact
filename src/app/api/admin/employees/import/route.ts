import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveRoles, getPlatformSetting } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// POST /api/admin/employees/import — src/app/api/admin/employees/import/route.ts:1
// Body: { rows: Array<Record<string, any>> } — one object per Excel row, keys
// already normalized client-side (see import page). Admin-only.
// Upserts innovation.employees by email, then replaces innovation.employee_roles
// for each employee based on the Yes/No role columns.
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
  const rows: Record<string, any>[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'no_rows' }, { status: 400 });
  }

  const internalDomain = await getPlatformSetting<string>('internal_email_domain', 'gac.gov.sa');
  const roles = await getActiveRoles();
  const roleByCode = new Map(roles.map((r) => [r.code, r]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: number; email?: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = String(r.email ?? '').trim().toLowerCase();
    const fullNameAr = String(r.full_name_ar ?? '').trim();
    const isInternal = r.is_internal !== false; // default true

    if (!email || !fullNameAr) {
      skipped++;
      errors.push({ row: i + 1, email, message: 'Missing required field (email or full_name_ar)' });
      continue;
    }
    if (isInternal && internalDomain && !email.endsWith(`@${internalDomain}`)) {
      skipped++;
      errors.push({ row: i + 1, email, message: `Internal employees must use @${internalDomain}` });
      continue;
    }

    // Upsert employee by email
    const { data: existing } = await admin
      .from('employees')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const payload = {
      employee_number: r.employee_number ? String(r.employee_number).trim() : null,
      full_name_ar: fullNameAr,
      full_name_en: r.full_name_en ? String(r.full_name_en).trim() : null,
      email,
      phone: r.phone ? String(r.phone).trim() : null,
      department: r.department ? String(r.department).trim() : null,
      job_title: r.job_title ? String(r.job_title).trim() : null,
      is_internal: isInternal,
      is_active: true,
      imported_by: user.id,
    };

    let employeeId: string;
    if (existing?.id) {
      const { error: updErr } = await admin.from('employees').update(payload).eq('id', existing.id);
      if (updErr) {
        skipped++;
        errors.push({ row: i + 1, email, message: updErr.message });
        continue;
      }
      employeeId = existing.id;
      updated++;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('employees')
        .insert(payload)
        .select('id')
        .single();
      if (insErr || !inserted) {
        skipped++;
        errors.push({ row: i + 1, email, message: insErr?.message ?? 'insert failed' });
        continue;
      }
      employeeId = inserted.id;
      imported++;
    }

    // Replace employee_roles: delete existing, insert Yes columns.
    await admin.from('employee_roles').delete().eq('employee_id', employeeId);
    const roleInserts: { employee_id: string; role_id: string; is_primary: boolean }[] = [];
    let primarySet = false;
    for (const role of roles) {
      const colKey = `role_${role.code}`;
      if (r[colKey] === true) {
        roleInserts.push({ employee_id: employeeId, role_id: role.id, is_primary: !primarySet });
        primarySet = true;
      }
    }
    if (roleInserts.length > 0) {
      await admin.from('employee_roles').insert(roleInserts);
    }
  }

  return NextResponse.json({ imported, updated, skipped, errors });
}
