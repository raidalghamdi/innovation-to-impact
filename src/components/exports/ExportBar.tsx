'use client';

// src/components/exports/ExportBar.tsx
// Reusable export toolbar dropped onto any admin/supervisor screen. Four
// actions: download PDF / PPTX / XLSX (POST to /api/exports/[format] and stream
// the response to a file download) and "Send by Email" (opens
// EmailExportModal). The concrete report is selected server-side by `screenId`
// via the export registry — this component is screen-agnostic plumbing.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Presentation, Sheet, Mail, Loader2 } from 'lucide-react';
import { EmailExportModal } from '@/components/exports/EmailExportModal';

export type ExportFormat = 'pdf' | 'pptx' | 'xlsx';

type Props = {
  screenId: string; // e.g. 'admin.analytics', 'admin.ideas'
  sensitive?: boolean; // if true, email is restricted to the requester only
  filters?: Record<string, string | number | undefined>; // URL/body passthrough
  onExport?: (format: ExportFormat) => Promise<void>; // optional custom hook
  selfEmail?: string; // requester's address, shown in the email modal
};

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, '').trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ? plain[1].trim() : fallback;
}

export function ExportBar({ screenId, sensitive = false, filters, onExport, selfEmail }: Props) {
  const t = useTranslations('exports');
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  async function download(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    try {
      if (onExport) {
        await onExport(format);
        return;
      }
      const res = await fetch(`/api/exports/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId, filters: filters ?? {} }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const filename = filenameFromDisposition(
        res.headers.get('Content-Disposition'),
        `${screenId}.${format}`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  const btn =
    'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => download('pdf')} disabled={busy !== null} className={btn}>
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {t('pdf')}
        </button>
        <button type="button" onClick={() => download('pptx')} disabled={busy !== null} className={btn}>
          {busy === 'pptx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
          {t('pptx')}
        </button>
        <button type="button" onClick={() => download('xlsx')} disabled={busy !== null} className={btn}>
          {busy === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
          {t('xlsx')}
        </button>
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-md bg-brand-teal px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          {t('sendEmail')}
        </button>
      </div>

      {emailOpen && (
        <EmailExportModal
          screenId={screenId}
          sensitive={sensitive}
          filters={filters}
          selfEmail={selfEmail}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </>
  );
}
