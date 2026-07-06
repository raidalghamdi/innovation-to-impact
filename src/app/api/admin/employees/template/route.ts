import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/user';
import { getActiveRoles } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// GET /api/admin/employees/template — src/app/api/admin/employees/template/route.ts:1
// Generates a blank .xlsx template with the exact Arabic headers expected by
// the import route, plus one role column per active innovation.roles row
// (dynamic — never hardcoded) and a hint row showing accepted values.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const roles = await getActiveRoles();

  const baseHeaders = [
    'رقم الموظف',
    'الاسم بالعربي',
    'الاسم بالإنجليزي',
    'البريد الإلكتروني',
    'الجوال',
    'القطاع/الإدارة',
    'المسمى الوظيفي',
    'داخلي',
  ];
  const roleHeaders = roles.map((r) => r.name_ar);
  const headers = [...baseHeaders, ...roleHeaders];

  const hintRow = [
    'EMP-0001',
    'محمد أحمد',
    'Mohammed Ahmed',
    'name@gac.gov.sa',
    '0500000000',
    'الابتكار',
    'محلل',
    'نعم',
    ...roles.map(() => 'نعم/لا'),
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, hintRow]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
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
