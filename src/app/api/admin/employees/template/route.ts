import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/user';
import { EMPLOYEE_IMPORT_ROLES } from '@/lib/employee-import';

export const dynamic = 'force-dynamic';

// GET /api/admin/employees/template — src/app/api/admin/employees/template/route.ts:1
// Generates a blank .xlsx template with the exact headers expected by the
// import route: full_name, email, role, department. A hint row documents the
// accepted role values. Admin OR supervisor (getCurrentUser promotes
// supervisor -> admin).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const headers = ['full_name', 'email', 'role', 'department'];
  const hintRow = ['Mohammed Ahmed', 'name@example.com', EMPLOYEE_IMPORT_ROLES.join(' | '), 'Innovation'];

  const ws = XLSX.utils.aoa_to_sheet([headers, hintRow]);
  ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 48 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const body = new Uint8Array(buf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="employees_template.xlsx"',
    },
  });
}
