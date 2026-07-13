'use client';

// Evaluator <-> track assignment matrix (R43). Rows are evaluators, columns are
// tracks (strategic themes); each cell is a checkbox toggling assign/unassign
// via POST /api/supervisor/evaluator-tracks. Optimistic update with rollback on
// failure. The table scrolls horizontally on mobile.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToastStack, ToastStack } from '@/components/ui/toast';

type Evaluator = { id: string; email: string | null; full_name: string | null };
type Track = { id: string; name: string };

export function EvaluatorTrackAssignments({
  evaluators,
  tracks,
  initialAssignments,
}: {
  evaluators: Evaluator[];
  tracks: Track[];
  // Set of "evaluatorId::trackId" pairs that are currently assigned.
  initialAssignments: string[];
}) {
  const t = useTranslations('admin.assignmentsTracks');
  const { toasts, push, dismiss } = useToastStack();
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(initialAssignments));
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const key = (evaluatorId: string, trackId: string) => `${evaluatorId}::${trackId}`;

  async function toggle(evaluatorId: string, trackId: string) {
    const k = key(evaluatorId, trackId);
    const currentlyAssigned = assigned.has(k);
    const action = currentlyAssigned ? 'unassign' : 'assign';

    // Optimistic update.
    setAssigned((prev) => {
      const next = new Set(prev);
      if (currentlyAssigned) next.delete(k);
      else next.add(k);
      return next;
    });
    setBusy((prev) => new Set(prev).add(k));

    try {
      const res = await fetch('/api/supervisor/evaluator-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluator_id: evaluatorId, track_id: trackId, action }),
      });
      if (!res.ok) throw new Error('request_failed');
    } catch {
      // Rollback.
      setAssigned((prev) => {
        const next = new Set(prev);
        if (currentlyAssigned) next.add(k);
        else next.delete(k);
        return next;
      });
      push({ title: t('saveFailed') });
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        <CardContent>
          {evaluators.length === 0 || tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                    <th className="sticky start-0 z-10 bg-muted/50 px-3 py-2 text-start font-semibold">
                      {t('evaluator')}
                    </th>
                    {tracks.map((track) => (
                      <th key={track.id} className="px-3 py-2 text-center font-semibold">
                        {track.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {evaluators.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/30">
                      <td className="sticky start-0 z-10 bg-background px-3 py-2">
                        <div className="font-medium">{ev.full_name || ev.email}</div>
                        {ev.full_name && (
                          <div className="text-xs text-muted-foreground" dir="ltr">
                            {ev.email}
                          </div>
                        )}
                      </td>
                      {tracks.map((track) => {
                        const k = key(ev.id, track.id);
                        return (
                          <td key={track.id} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-brand-teal"
                              checked={assigned.has(k)}
                              disabled={busy.has(k)}
                              onChange={() => toggle(ev.id, track.id)}
                              aria-label={`${ev.full_name || ev.email} — ${track.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
