'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import { pickFromRow, pick } from '@/lib/i18n-content';
import {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  bulkDeleteAssignments,
} from '@/app/[locale]/admin/assignments/actions';
import type { AssignmentRow, IdeaOption, EvaluatorOption } from '@/lib/data';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-gray-200 text-gray-600',
};

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

export function AssignmentsManager({
  rows,
  ideaOptions,
  evaluatorOptions,
  locale,
}: {
  rows: AssignmentRow[];
  ideaOptions: IdeaOption[];
  evaluatorOptions: EvaluatorOption[];
  locale: string;
}) {
  const t = useTranslations('admin.assignments');
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [pending, startTransition] = useTransition();

  // New-assignment form state.
  const [ideaId, setIdeaId] = useState('');
  const [evaluatorId, setEvaluatorId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');

  const evalLabel = (o: EvaluatorOption) => o.email || o.full_name || o.id;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function run(fn: () => Promise<{ ok: boolean }>, okMsg: string) {
    setStatus({ kind: 'idle', message: '' });
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setStatus({ kind: 'ok', message: okMsg });
        router.refresh();
      } else {
        setStatus({ kind: 'error', message: t('actionError') });
      }
    });
  }

  function submitNew() {
    if (!ideaId || !evaluatorId) {
      setStatus({ kind: 'error', message: t('pickerRequired') });
      return;
    }
    run(
      () => createAssignment({ ideaId, evaluatorId, dueAt: dueAt || null, notes: notes || null }),
      t('createdOk')
    );
    setDialogOpen(false);
    setIdeaId('');
    setEvaluatorId('');
    setDueAt('');
    setNotes('');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#01696F]" />
            {t('selectAll')}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} {t('selectedCount')}
              </span>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  const ids = [...selected];
                  run(() => bulkDeleteAssignments(ids), t('unassignedOk'));
                  setSelected(new Set());
                }}
              >
                {t('bulkUnassign')}
              </Button>
            </>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)}>{t('newAssignment')}</Button>
      </div>

      <p
        aria-live="polite"
        className={
          status.kind === 'error'
            ? 'text-sm font-medium text-red-600'
            : status.kind === 'ok'
              ? 'text-sm font-medium text-emerald-600'
              : 'sr-only'
        }
      >
        {status.message}
      </p>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3" />
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colIdea')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colEvaluator')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colAssignedAt')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colDueAt')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colStatus')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          className="h-4 w-4 accent-[#01696F]"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">{pickFromRow(r, 'idea_title', locale) || '—'}</p>
                        <p className="font-mono text-xs text-muted-foreground" dir="ltr">{r.idea_code ?? r.idea_id}</p>
                      </td>
                      <td className="p-3 text-muted-foreground" dir="ltr">
                        <a
                          href={`/${locale}/admin/users/${r.evaluator_id}`}
                          className="text-brand-teal hover:underline"
                        >
                          {r.evaluator_email || r.evaluator_name || r.evaluator_id}
                        </a>
                      </td>
                      <td className="p-3 text-muted-foreground" dir="ltr">{r.assigned_at?.slice(0, 10) ?? '—'}</td>
                      <td className="p-3 text-muted-foreground" dir="ltr">{r.due_at?.slice(0, 10) ?? '—'}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.declined}`}>
                          {t(`status_${r.status}`)}
                        </span>
                      </td>
                      <td className="p-3">
                        {reassignId === r.id ? (
                          <div className="flex flex-col gap-1">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const to = e.target.value;
                                if (to) {
                                  run(() => updateAssignment(r.id, { evaluatorId: to }), t('reassignedOk'));
                                  setReassignId(null);
                                }
                              }}
                              className="rounded-md border border-border bg-background p-1 text-xs"
                            >
                              <option value="" disabled>{t('pickEvaluator')}</option>
                              {evaluatorOptions.map((o) => (
                                <option key={o.id} value={o.id}>{evalLabel(o)}</option>
                              ))}
                            </select>
                            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setReassignId(null)}>
                              {t('cancel')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs text-brand-teal underline disabled:opacity-50"
                              disabled={pending || r.status === 'declined'}
                              onClick={() => setReassignId(r.id)}
                            >
                              {t('reassign')}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-600 underline disabled:opacity-50"
                              disabled={pending || r.status === 'declined'}
                              onClick={() => run(() => deleteAssignment(r.id), t('unassignedOk'))}
                            >
                              {t('unassign')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialogOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-brand-teal">{t('newAssignment')}</h2>
                <button type="button" onClick={() => setDialogOpen(false)} aria-label={t('cancel')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('pickIdea')}
                <select value={ideaId} onChange={(e) => setIdeaId(e.target.value)} className="rounded-md border border-border bg-background p-2 text-sm">
                  <option value="" disabled>{t('pickIdea')}</option>
                  {ideaOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.code} — {pick(o.title_ar, o.title_en, locale)}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('pickEvaluator')}
                <select value={evaluatorId} onChange={(e) => setEvaluatorId(e.target.value)} className="rounded-md border border-border bg-background p-2 text-sm">
                  <option value="" disabled>{t('pickEvaluator')}</option>
                  {evaluatorOptions.map((o) => (
                    <option key={o.id} value={o.id}>{evalLabel(o)}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('dueAtOptional')}
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-md border border-border bg-background p-2 text-sm" />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('notesOptional')}
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </label>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>{t('cancel')}</Button>
                <Button onClick={submitNew} disabled={pending}>{t('create')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
