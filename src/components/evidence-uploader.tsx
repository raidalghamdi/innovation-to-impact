'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, FileText, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  uploadEvidence,
  listEvidence,
  deleteEvidence,
} from '@/lib/storage';
import {
  validateUploadFile,
  UPLOAD_ACCEPT_ATTR,
  type EvidenceContext,
  type EvidenceWithUrl,
} from '@/lib/evidence-types';

type PendingItem = { name: string; error?: string };

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceUploader({
  entityType,
  entityId,
  ideaId,
  context,
  accept = UPLOAD_ACCEPT_ATTR,
  locale,
}: {
  entityType: string;
  entityId: string;
  ideaId?: string | null;
  context: EvidenceContext;
  accept?: string;
  locale: string;
}) {
  const t = useTranslations('evidence');
  const te = useTranslations('errors');
  const isAr = locale === 'ar';
  const [items, setItems] = useState<EvidenceWithUrl[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const rows = await listEvidence(entityType, entityId);
    setItems(rows);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    // Seed the pending tray so the user sees each file the moment it's queued.
    setPending((prev) => [...prev, ...list.map((f) => ({ name: f.name }))]);

    for (const file of list) {
      const invalid = validateUploadFile(file);
      if (invalid) {
        setPending((prev) =>
          prev.map((p) => (p.name === file.name ? { ...p, error: te(invalid) } : p))
        );
        continue;
      }
      const res = await uploadEvidence(file, context, { ideaId, entityType, entityId });
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.name !== file.name));
        await refresh();
      } else {
        setPending((prev) =>
          prev.map((p) => (p.name === file.name ? { ...p, error: t('uploadError') } : p))
        );
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteEvidence(id);
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <div className="space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? 'border-brand-teal bg-brand-teal-light/40' : 'border-border bg-muted/30 hover:border-brand-teal/40'
        }`}
      >
        <UploadCloud className="h-6 w-6 text-brand-teal" />
        <span className="text-sm font-medium text-foreground">{t('dropzone')}</span>
        <span className="text-xs text-muted-foreground">{t('hint')}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Pending uploads with an indeterminate progress bar. */}
      {pending.length > 0 && (
        <ul className="space-y-1.5">
          {pending.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                {p.error ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-teal" />
                )}
                <span className="line-clamp-1 flex-1">{p.name}</span>
              </div>
              {p.error ? (
                <p className="mt-1 text-xs text-red-600">{p.error}</p>
              ) : (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-teal" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Existing evidence. */}
      {loading ? (
        <p className="text-xs text-muted-foreground">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-brand-teal" />
              <div className="min-w-0 flex-1">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-1 font-medium text-brand-teal hover:underline"
                  >
                    {item.filename}
                  </a>
                ) : (
                  <span className="line-clamp-1 font-medium">{item.filename}</span>
                )}
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {formatSize(item.size_bytes)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                aria-label={t('delete')}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
