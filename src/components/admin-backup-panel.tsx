'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type ImportSummary = {
  ok: boolean;
  totals: { upserted: number; skipped: number; errors: number };
  summary: { table: string; upserted: number; skipped: number; error?: string }[];
};

// src/components/admin-backup-panel.tsx
// Admin-only UI for full-database export and merge-only import. Both actions
// are gated by re-entering the admin's login password — the server verifies it
// via supabase.auth.signInWithPassword before touching data.
//
// Responsive: two-column on lg+, stacked on mobile. Password field spans full
// width so touch keyboards don't clip it.
export function AdminBackupPanel({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [exportPw, setExportPw] = useState('');
  const [importPw, setImportPw] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  const errorText = (code: string) => {
    if (!isAr) {
      switch (code) {
        case 'invalid_password':
          return 'Incorrect password.';
        case 'password_required':
          return 'Password is required.';
        case 'forbidden':
          return 'Only administrators can run backups.';
        case 'no_session':
          return 'Session expired — please sign in again.';
        case 'file_required':
          return 'Please choose an Excel file.';
        case 'invalid_xlsx':
          return 'The uploaded file is not a valid Excel workbook.';
        case 'service_unavailable':
          return 'Backup service is temporarily unavailable.';
        default:
          return code;
      }
    }
    switch (code) {
      case 'invalid_password':
        return 'كلمة المرور غير صحيحة.';
      case 'password_required':
        return 'كلمة المرور مطلوبة.';
      case 'forbidden':
        return 'النسخ الاحتياطي متاح للمسؤولين فقط.';
      case 'no_session':
        return 'انتهت الجلسة — الرجاء تسجيل الدخول مجدداً.';
      case 'file_required':
        return 'اختر ملف Excel للاستيراد.';
      case 'invalid_xlsx':
        return 'الملف المرفوع ليس ملف Excel صحيحاً.';
      case 'service_unavailable':
        return 'خدمة النسخ الاحتياطي غير متاحة مؤقتاً.';
      default:
        return code;
    }
  };

  async function handleExport() {
    setExportError(null);
    if (!exportPw) {
      setExportError(errorText('password_required'));
      return;
    }
    setExportBusy(true);
    try {
      const res = await fetch('/api/admin/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: exportPw }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        setExportError(errorText(j.error || 'unknown'));
        setExportBusy(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `i2i-full-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportPw('');
    } catch (e: any) {
      setExportError(e?.message ?? 'network_error');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImport() {
    setImportError(null);
    setImportResult(null);
    if (!importPw) {
      setImportError(errorText('password_required'));
      return;
    }
    if (!file) {
      setImportError(errorText('file_required'));
      return;
    }
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('password', importPw);
      fd.append('file', file);
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        body: fd,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setImportError(errorText(j?.error || 'unknown'));
        setImportBusy(false);
        return;
      }
      setImportResult(j as ImportSummary);
      setImportPw('');
      setFile(null);
      // Clear the native file input's DOM value so the user can re-select
      // the same file if they choose to.
      const input = document.getElementById('backup-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: any) {
      setImportError(e?.message ?? 'network_error');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Export card ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-teal">
            <Download className="h-5 w-5" />
            {isAr ? 'تصدير نسخة كاملة' : 'Export full backup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'يُنزّل ملف Excel واحد يحتوي كل جداول قاعدة البيانات (ورقة لكل جدول). كلمة المرور مطلوبة للتأكد من هويتك.'
              : 'Downloads a single Excel workbook containing every DB table (one sheet per table). Your password is required to confirm your identity.'}
          </p>

          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>
                {isAr
                  ? 'الملف يحتوي بيانات حساسة. احفظه في مكان آمن ولا تشاركه إلا مع من يملك صلاحية الوصول.'
                  : 'The file contains sensitive data. Store it securely and share only with authorized recipients.'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="export-pw">
              {isAr ? 'كلمة مرور المسؤول' : 'Admin password'}
            </Label>
            <Input
              id="export-pw"
              type="password"
              autoComplete="current-password"
              value={exportPw}
              onChange={(e) => setExportPw(e.target.value)}
              disabled={exportBusy}
              placeholder="••••••••"
              className="w-full"
            />
          </div>

          {exportError && (
            <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive" role="alert">
              {exportError}
            </p>
          )}

          <Button
            onClick={handleExport}
            disabled={exportBusy || !exportPw}
            className="w-full sm:w-auto"
          >
            {exportBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isAr ? 'جاري التصدير…' : 'Exporting…'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {isAr ? 'تنزيل ملف Excel' : 'Download Excel'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Import card ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-teal">
            <Upload className="h-5 w-5" />
            {isAr ? 'استيراد نسخة (دمج آمن)' : 'Import backup (safe merge)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'يُدمج الصفوف من الملف داخل الجداول الحالية دون حذف أي بيانات. الصفوف الموجودة بنفس المعرّف يتم تحديثها، والجديدة تُضاف.'
              : 'Merges rows from the file into your existing tables without deleting anything. Rows with matching IDs are updated; new rows are inserted.'}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="backup-file-input">
              {isAr ? 'ملف النسخة الاحتياطية (Excel)' : 'Backup file (Excel)'}
            </Label>
            <Input
              id="backup-file-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={importBusy}
              className="w-full cursor-pointer file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-teal file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-teal-dark"
            />
            {file && (
              <p className="text-xs text-muted-foreground" dir="ltr">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-pw">
              {isAr ? 'كلمة مرور المسؤول' : 'Admin password'}
            </Label>
            <Input
              id="import-pw"
              type="password"
              autoComplete="current-password"
              value={importPw}
              onChange={(e) => setImportPw(e.target.value)}
              disabled={importBusy}
              placeholder="••••••••"
              className="w-full"
            />
          </div>

          {importError && (
            <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive" role="alert">
              {importError}
            </p>
          )}

          {importResult && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-brand-teal">
                <CheckCircle2 className="h-4 w-4" />
                {isAr ? 'اكتمل الاستيراد' : 'Import complete'}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-card p-2">
                  <p className="text-lg font-bold text-brand-teal">
                    {importResult.totals.upserted}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAr ? 'صفوف مدموجة' : 'Rows merged'}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2">
                  <p className="text-lg font-bold text-muted-foreground">
                    {importResult.totals.skipped}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAr ? 'تم تخطيها' : 'Skipped'}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2">
                  <p className="text-lg font-bold text-destructive">
                    {importResult.totals.errors}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAr ? 'جداول بأخطاء' : 'Table errors'}
                  </p>
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-brand-teal">
                  {isAr ? 'تفاصيل لكل جدول' : 'Per-table details'}
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-start text-muted-foreground">
                        <th className="py-1 text-start font-semibold">
                          {isAr ? 'الجدول' : 'Table'}
                        </th>
                        <th className="py-1 text-end font-semibold">
                          {isAr ? 'مدموج' : 'Merged'}
                        </th>
                        <th className="py-1 text-end font-semibold">
                          {isAr ? 'تخطي' : 'Skipped'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.summary.map((s) => (
                        <tr key={s.table} className="border-t border-border/60">
                          <td className="py-1 font-mono" dir="ltr">{s.table}</td>
                          <td className="py-1 text-end">{s.upserted}</td>
                          <td className="py-1 text-end">
                            {s.error ? (
                              <span className="text-destructive" title={s.error}>
                                ⚠ {s.skipped}
                              </span>
                            ) : (
                              s.skipped
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={importBusy || !file || !importPw}
            className="w-full sm:w-auto"
          >
            {importBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isAr ? 'جاري الاستيراد…' : 'Importing…'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {isAr ? 'دمج الملف' : 'Merge file'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
