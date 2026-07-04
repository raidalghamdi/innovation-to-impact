'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { EVALUATION_CRITERIA, MAX_TOTAL, computeTotal } from '@/lib/evaluation';
import {
  saveEvaluation,
  fetchEvaluationForIdea,
  type ExistingEvaluation,
} from '@/app/[locale]/evaluation/actions';

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

const DEFAULT_SCORES = () =>
  Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c.key, 3])) as Record<string, number>;

export function EvaluationScorecard({
  ideaId,
  onSaved,
}: {
  ideaId: string;
  onSaved?: () => void;
}) {
  const t = useTranslations('evaluation');
  const tc = useTranslations('common');
  const [scores, setScores] = useState<Record<string, number>>(DEFAULT_SCORES);
  const [noConflict, setNoConflict] = useState(false);
  const [comments, setComments] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [pending, startTransition] = useTransition();
  const [existing, setExisting] = useState<ExistingEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate any existing draft or submitted evaluation on mount / idea change (F-17).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStatus({ kind: 'idle', message: '' });
    fetchEvaluationForIdea(ideaId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.evaluation) {
        const e = res.evaluation;
        const hydrated = { ...DEFAULT_SCORES(), ...(e.criteria_scores ?? {}) };
        setScores(hydrated);
        setComments(e.comments ?? '');
        // If a prior submission acknowledged no-conflict, keep the box ticked.
        setNoConflict(Boolean(e.submitted_at) && e.conflict_of_interest === false);
        setExisting(e);
      } else {
        setScores(DEFAULT_SCORES());
        setComments('');
        setNoConflict(false);
        setExisting(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  const total = useMemo(() => computeTotal(scores), [scores]);
  const alreadySubmitted = Boolean(existing?.submitted_at);

  function persist(submit: boolean) {
    if (submit && !noConflict) {
      setStatus({ kind: 'error', message: t('coiRequired') });
      return;
    }
    setStatus({ kind: 'idle', message: '' });
    startTransition(async () => {
      const res = await saveEvaluation({
        ideaId,
        criteriaScores: scores,
        comments,
        conflictOfInterest: false, // form only supports the "no conflict" path
        submit,
      });
      if (!res.ok) {
        setStatus({ kind: 'error', message: t('saveError') });
        return;
      }
      setStatus({
        kind: 'ok',
        message: submit ? t('submitted') : t('draftSaved'),
      });
      // Reflect the new stored state locally so the button labels update.
      setExisting({
        criteria_scores: scores,
        comments: comments || null,
        conflict_of_interest: false,
        submitted_at: submit ? new Date().toISOString() : null,
      });
      onSaved?.();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        {alreadySubmitted && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('alreadySubmitted')}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="teal-header">
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">
                  {t('criteria')}
                </th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">
                  {t('score')} (1–5)
                </th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION_CRITERIA.map((c) => (
                <tr key={c.key} className="border-t border-border">
                  <td className="px-4 py-3">{t(`criteriaLabels.${c.key}`)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={scores[c.key]}
                      disabled={loading || alreadySubmitted}
                      onChange={(e) =>
                        setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))
                      }
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
            {total} / {MAX_TOTAL}
          </span>
        </div>

        <Textarea
          placeholder={t('comments')}
          value={comments}
          disabled={loading || alreadySubmitted}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={noConflict}
            disabled={loading || alreadySubmitted}
            onChange={(e) => setNoConflict(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#01696F]"
          />
          <span>{t('coiAcknowledgement')}</span>
        </label>

        {!alreadySubmitted && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => persist(true)}
              disabled={pending || loading || !noConflict}
            >
              {pending ? t('saving') : tc('submit')}
            </Button>
            <Button
              variant="outline"
              onClick={() => persist(false)}
              disabled={pending || loading}
            >
              {t('saveDraft')}
            </Button>
          </div>
        )}

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
