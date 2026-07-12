// Shared spec for the Employees Import feature (admin + supervisor).
// The uploaded XLSX has four columns: full_name, email, role, department.
// English headers are canonical; common Arabic aliases are accepted so a
// bilingual spreadsheet still parses.

export const EMPLOYEE_IMPORT_ROLES = [
  'admin',
  'supervisor',
  'evaluator',
  'judge',
  'innovator',
  'submitter',
] as const;

export type EmployeeImportRole = (typeof EMPLOYEE_IMPORT_ROLES)[number];

export type EmployeeImportRow = {
  full_name: string;
  email: string;
  role: string;
  department: string;
};

// Header (Arabic or English) → canonical field name.
const HEADER_ALIASES: Record<string, keyof EmployeeImportRow> = {
  full_name: 'full_name',
  'full name': 'full_name',
  name: 'full_name',
  'الاسم': 'full_name',
  'الاسم الكامل': 'full_name',
  email: 'email',
  'e-mail': 'email',
  'البريد الإلكتروني': 'email',
  'البريد': 'email',
  role: 'role',
  'الدور': 'role',
  'الصلاحية': 'role',
  department: 'department',
  dept: 'department',
  'القطاع/الإدارة': 'department',
  'الإدارة': 'department',
  'القسم': 'department',
};

export function normalizeHeader(raw: string): keyof EmployeeImportRow | null {
  return HEADER_ALIASES[String(raw).trim().toLowerCase()] ?? HEADER_ALIASES[String(raw).trim()] ?? null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidImportRole(role: string): boolean {
  return (EMPLOYEE_IMPORT_ROLES as readonly string[]).includes(role.trim().toLowerCase());
}

// Validate a single row. Returns a list of human-readable error strings
// (empty when the row is valid). `t` maps an error code to a localized message.
export function validateImportRow(
  row: Partial<EmployeeImportRow>,
  t: (code: 'name' | 'email' | 'role') => string
): string[] {
  const errors: string[] = [];
  if (!row.full_name || !String(row.full_name).trim()) errors.push(t('name'));
  const email = String(row.email ?? '').trim();
  if (!email || !isValidEmail(email)) errors.push(t('email'));
  const role = String(row.role ?? '').trim();
  if (!role || !isValidImportRole(role)) errors.push(t('role'));
  return errors;
}
