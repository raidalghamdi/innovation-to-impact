'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { moveChangeRequest, type CrState } from '@/app/[locale]/admin/change-requests/actions';

export type ChangeRequestRow = {
  id: string;
  requested_by: string | null;
  requester_name: string | null;
  entity_type: string;
  entity_id: string;
  field_path: string;
  current_value: unknown;
  proposed_value: unknown;
  reason_ar: string | null;
  reason_en: string | null;
  status: CrState;
  created_at: string;
};

const COLUMNS: CrState[] = ['requested', 'in_review', 'approved', 'applied'];

function ageLabel(iso: string, unit: (k: string, v: { n: number }) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return unit('days', { n: days });
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return unit('hours', { n: hours });
  return unit('minutes', { n: Math.max(1, Math.floor(ms / 60_000)) });
}

function jsonPreview(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ChangeRequestBoard({
  initial,
  locale,
}: {
  initial: ChangeRequestRow[];
  locale: string;
}) {
  const t = useTranslations('changeRequests');
  const isAr = locale === 'ar';
  const [rows, setRows] = useState<ChangeRequestRow[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChangeRequestRow | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byStatus = useMemo(() => {
    const map: Record<string, ChangeRequestRow[]> = {};
    for (const s of [...COLUMNS, 'rejected']) map[s] = [];
    for (const r of rows) (map[r.status] ??= []).push(r);
    return map;
  }, [rows]);

  const rejected = byStatus['rejected'] ?? [];

  function move(id: string, to: CrState) {
    const current = rows.find((r) => r.id === id);
    if (!current || current.status === to) return;
    const prevStatus = current.status;
    setError(null);
    // Optimistic move; revert if the server rejects the transition.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: to } : r)));
    startTransition(async () => {
      const res = await moveChangeRequest(id, to);
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: prevStatus } : r)));
        setError(res.error ?? 'error');
      }
    });
  }

  function card(r: ChangeRequestRow) {
    return (
      <div
        key={r.id}
        draggable
        onDragStart={() => setDragId(r.id)}
        onDragEnd={() => setDragId(null)}
        onClick={() => setDetail(r)}
        className="cursor-grab rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition hover:border-brand-teal/40 active:cursor-grabbing"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {r.entity_type}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {ageLabel(r.created_at, (k, v) => t(`age.${k}`, v))}
          </span>
        </div>
        <p className="mt-1 font-medium text-foreground" dir="ltr">
          {r.field_path}
        </p>
        <div className="mt-1.5 space-y-0.5 text-xs" dir="ltr">
          <p className="truncate text-red-600 line-through">{jsonPreview(r.current_value)}</p>
          <p className="truncate text-emerald-700">{jsonPreview(r.proposed_value)}</p>
        </div>
        {r.requester_name && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">{r.requester_name}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Rejected pill + error surface */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowRejected((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
            showRejected ? 'border-red-400 bg-red-50 text-red-700' : 'border-border text-muted-foreground'
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
          {t('rejectedPill', { n: rejected.length })}
        </button>
        {error && (
          <span className="text-xs font-medium text-red-600">{t('transitionError')}</span>
        )}
      </div>

      {showRejected && rejected.length > 0 && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {rejected.map(card)}
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            key={col}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, col);
              setDragId(null);
            }}
            className="flex flex-col rounded-xl border border-border bg-muted/30 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-teal">{t(`status.${col}`)}</h3>
              <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-xs font-medium text-brand-teal">
                {byStatus[col]?.length ?? 0}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {(byStatus[col] ?? []).map(card)}
              {(byStatus[col]?.length ?? 0) === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">{t('columnEmpty')}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-brand-teal">{t('detailTitle')}</h2>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {detail.entity_type} · {detail.entity_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label={t('close')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t('fieldPath')}</p>
                <p className="font-mono" dir="ltr">{detail.field_path}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-xs font-semibold text-red-700">{t('currentValue')}</p>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-xs" dir="ltr">
                    {jsonPreview(detail.current_value)}
                  </pre>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-xs font-semibold text-emerald-700">{t('proposedValue')}</p>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-xs" dir="ltr">
                    {jsonPreview(detail.proposed_value)}
                  </pre>
                </div>
              </div>
              {(detail.reason_en || detail.reason_ar) && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{t('reason')}</p>
                  <p>{isAr ? detail.reason_ar || detail.reason_en : detail.reason_en || detail.reason_ar}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => {
                  move(detail.id, 'approved');
                  setDetail(null);
                }}
                className="flex-1"
              >
                <Check className="h-4 w-4" />
                {t('approve')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  move(detail.id, 'rejected');
                  setDetail(null);
                }}
                className="flex-1"
              >
                <Ban className="h-4 w-4" />
                {t('reject')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
