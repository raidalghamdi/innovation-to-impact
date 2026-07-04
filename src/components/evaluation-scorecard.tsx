'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { EVALUATION_CRITERIA, computeTotal } from '@/lib/evaluation';
import { saveEvaluation } from '@/app/[locale]/evaluation/actions';

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

export function EvaluationScorecard({
  ideaId,
  onSaved,
}: {
  ideaId: string;
  onSaved?: () => void;
}) {
  const t = useTranslations('evaluation');
  const tc = useTranslations('common');
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c.key, 3]))
  );
  const [conflict, setConflict] = useState(false);
  const [comments, setComments] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => computeTotal(scores), [scores]);

  function persist(submit: boolean) {
    setStatus({ kind: 'idle', message: '' });
    startTransition(async () => {
      const res = await saveEvaluation({
        ideaId,
        criteriaScores: scores,
        comments,
        conflictOfInterest: conflict,
        submit,
      });
      if (!res.ok) {
        setStatus({ kind: 'error', message: t('saveError') });
        return;
      }
      const message = conflict
        ? t('conflictRecorded')
        : submit
          ? t('submitted')
          : t('draftSaved');
      setStatus({ kind: 'ok', message });
      onSaved?.();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="teal-header">
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('criteria')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('weight')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('score')} (1–5)</th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION_CRITERIA.map((c) => (
                <tr key={c.key} className="border-t border-border">
                  <td className="px-4 py-3">{t(`criteriaLabels.${c.key}`)}</td>
                  <td className="px-4 py-3">{Math.round(c.weight * 100)}%</td>
                  <td className="px-4 py-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={scores[c.key]}
                      disabled={conflict}
                      onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
                      className="w-40 accent-[#01696F] disabled:opacity-40"
                    />
                    <span className="ms-2 font-medium">{scores[c.key]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between rounded-md bg-brand-teal-light p-4">
          <span className="font-medium text-brand-teal">{t('totalScore')}</span>
          <span className="text-2xl font-bold text-brand-teal">
            {conflict ? '—' : total.toFixed(1)}
          </span>
        </div>

        <Textarea
          placeholder={t('comments')}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conflict}
            onChange={(e) => setConflict(e.target.checked)}
            className="h-4 w-4 accent-[#01696F]"
          />
          {t('conflict')}
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => persist(true)} disabled={pending}>
            {pending ? t('saving') : tc('submit')}
          </Button>
          {!conflict && (
            <Button variant="outline" onClick={() => persist(false)} disabled={pending}>
              {t('saveDraft')}
            </Button>
          )}
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
      </CardContent>
    </Card>
  );
}
