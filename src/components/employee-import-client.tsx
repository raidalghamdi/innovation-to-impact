'use client';

// src/components/employee-import-client.tsx:1
// Employee importer (admin + supervisor). Drag-drop or file-picker accepts
// .xlsx/.xls/.csv, parsed client-side with SheetJS ("xlsx"). Columns:
// full_name, email, role, department. Shows a preview table with per-row
// validation before submit; the server re-validates and creates pending
// invitations.
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UploadCloud, Download, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  normalizeHeader,
  validateImportRow,
  EMPLOYEE_IMPORT_ROLES,
  type EmployeeImportRow,
} from '@/lib/employee-import';

type ValidatedRow = Partial<EmployeeImportRow> & { _errors: string[]; _rowNum: number };

type ImportResult = {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; email?: string; message: string }[];
};

export function EmployeeImportClient({ locale }: { locale: string; roles?: unknown }) {
  const t = useTranslations('employeeImport');
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const errText = useCallback(
    (code: 'name' | 'email' | 'role') =>
      code === 'name' ? t('errRequiredName') : code === 'email' ? t('errEmail') : t('errRole'),
    [t]
  );

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      setResult(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const parsed: ValidatedRow[] = json.map((raw, idx) => {
          const out: Partial<EmployeeImportRow> = {};
          for (const key of Object.keys(raw)) {
            const field = normalizeHeader(key);
            if (field) out[field] = String(raw[key] ?? '').trim();
          }
          if (out.email) out.email = out.email.toLowerCase();
          if (out.role) out.role = out.role.toLowerCase();
          return { ...out, _errors: validateImportRow(out, errText), _rowNum: idx + 2 };
        });

        setRows(parsed);
      };
      reader.readAsBinaryString(file);
    },
    [errText]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const validCount = useMemo(() => rows.filter((r) => r._errors.length === 0).length, [rows]);
  const invalidCount = rows.length - validCount;

  async function handleSubmit() {
    setSubmitting(true);
    setResult(null);
    try {
      const validRows = rows
        .filter((r) => r._errors.length === 0)
        .map(({ full_name, email, role, department }) => ({ full_name, email, role, department }));
      const res = await fetch('/api/admin/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ total: rows.length, imported: 0, skipped: rows.length, errors: [{ row: 0, message: String(err) }] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('templateTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('templateHint')}</p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              full_name, email, role, department
            </p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {t('rolesHint')}: {EMPLOYEE_IMPORT_ROLES.join(', ')}
            </p>
          </div>
          <Button asChild variant="outline" className="border-brand-teal text-brand-teal hover:bg-brand-teal-light">
            <a href="/api/admin/employees/template" download>
              <Download className="h-4 w-4" />
              {t('downloadTemplate')}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
              dragOver ? 'border-brand-teal bg-brand-teal-light/40' : 'border-border bg-muted/30'
            }`}
          >
            <UploadCloud className="h-8 w-8 text-brand-teal" />
            <p className="text-sm font-medium text-foreground">{fileName || t('dropHint')}</p>
            <p className="text-xs text-muted-foreground">{t('acceptedFormats')}</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">{t('totalRows', { count: rows.length })}</span>
              <span className="inline-flex items-center gap-1.5 text-green-700">
                <CheckCircle2 className="h-4 w-4" /> {t('validRows', { count: validCount })}
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <XCircle className="h-4 w-4" /> {t('invalidRows', { count: invalidCount })}
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-xs sm:text-sm">
                <thead>
                  <tr className="teal-header">
                    <th className="px-3 py-2 text-start">#</th>
                    <th className="px-3 py-2 text-start">{t('colName')}</th>
                    <th className="px-3 py-2 text-start">{t('colEmail')}</th>
                    <th className="px-3 py-2 text-start">{t('colRole')}</th>
                    <th className="px-3 py-2 text-start">{t('colDept')}</th>
                    <th className="px-3 py-2 text-start">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r) => (
                    <tr key={r._rowNum} className={`border-t border-border ${r._errors.length ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">{r._rowNum}</td>
                      <td className="px-3 py-2">{r.full_name || '—'}</td>
                      <td className="px-3 py-2" dir="ltr">{r.email || '—'}</td>
                      <td className="px-3 py-2" dir="ltr">{r.role || '—'}</td>
                      <td className="px-3 py-2">{r.department || '—'}</td>
                      <td className="px-3 py-2">
                        {r._errors.length ? (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> {r._errors.join('; ')}
                          </span>
                        ) : (
                          <span className="text-green-700">{t('ok')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && (
              <p className="mt-2 text-xs text-muted-foreground">{t('previewLimited', { total: rows.length })}</p>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting || validCount === 0}>
                {submitting ? t('importing') : t('importButton', { count: validCount })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm font-semibold text-brand-teal">{t('resultTitle')}</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-lg font-bold text-blue-700">{result.total}</p>
                <p className="text-xs text-muted-foreground">{t('total')}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-lg font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-muted-foreground">{t('imported')}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-lg font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">{t('skipped')}</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {t('rowLabel')} {e.row}: {e.email ? `${e.email} — ` : ''}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
