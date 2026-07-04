'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, RotateCcw, Search, X } from 'lucide-react';
import { recordDecision, type Decision } from '@/app/[locale]/committee/actions';
import { pickFromRow } from '@/lib/i18n-content';

type EvaluatorScorecard = {
  evaluatorId: string;
  evaluatorName: string;
  totalScore: number | null;
  criteriaScores: Record<string, number> | null;
  comments: string | null;
  conflict: boolean;
  submittedAt: string | null;
};

type Summary = {
  count: number;
  avgTotal: number | null;
  perCriterion: Record<string, number>;
  conflicts: number;
  scorecards: EvaluatorScorecard[];
};

export type CommitteeIdea = {
  id: string;
  code: string;
  title_ar: string;
  title_en: string;
  problem_statement: string;
  proposed_solution: string;
  expected_benefits: string;
  summary: Summary | null;
};

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

export function CommitteeDecisionPanel({
  ideas,
  locale,
  quorumMet,
}: {
  ideas: CommitteeIdea[];
  locale: string;
  quorumMet: boolean;
}) {
  const t = useTranslations('committee');
  const te = useTranslations('evaluation');
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<CommitteeIdea | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [pending, startTransition] = useTransition();

  const title = (i: CommitteeIdea) => pickFromRow(i, 'title', locale);
  const allSelected = ideas.length > 0 && selected.size === ideas.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ideas.map((i) => i.id)));
  }

  function decide(ideaIds: string[], decision: Decision) {
    if (!ideaIds.length) return;
    if ((decision === 'reject' || decision === 'return') && !comment.trim()) {
      setStatus({ kind: 'error', message: t('commentRequired') });
      return;
    }
    setStatus({ kind: 'idle', message: '' });
    startTransition(async () => {
      const res = await recordDecision({ ideaIds, decision, comments: comment.trim() });
      if (!res.ok) {
        setStatus({ kind: 'error', message: t('decisionError') });
        return;
      }
      setStatus({ kind: 'ok', message: t('decisionRecorded') });
      setSelected(new Set());
      setComment('');
      setDetail(null);
      router.refresh();
    });
  }

  const decisionButtons = useMemo(
    () =>
      [
        { decision: 'approve' as Decision, label: t('approve'), icon: CheckCircle2, variant: 'default' as const },
        { decision: 'reject' as Decision, label: t('reject'), icon: XCircle, variant: 'destructive' as const },
        { decision: 'return' as Decision, label: t('return'), icon: RotateCcw, variant: 'outline' as const },
        { decision: 'study' as Decision, label: t('study'), icon: Search, variant: 'secondary' as const },
      ],
    [t]
  );

  if (ideas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('queueEmpty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-[#01696F]"
            />
            {t('selectAll')}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} {t('selectedCount')}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {t('clearSelection')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-brand-teal">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium text-brand-teal">
              {t('applyToSelected')} ({selected.size})
            </p>
            <Textarea
              placeholder={t('commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              {decisionButtons.map((b) => (
                <Button
                  key={b.decision}
                  size="sm"
                  variant={b.variant}
                  disabled={pending || !quorumMet}
                  onClick={() => decide([...selected], b.decision)}
                >
                  <b.icon className="h-4 w-4" />
                  {b.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
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

      {ideas.map((i) => (
        <Card key={i.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  className="mt-1 h-4 w-4 accent-[#01696F]"
                />
                <CardTitle className="text-brand-teal">{title(i)}</CardTitle>
              </label>
              <span className="shrink-0 text-xs font-medium text-brand-gold">{i.code}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Aggregated evaluator scores (F-19) */}
            <div className="flex flex-wrap items-center gap-4 rounded-md bg-brand-teal-light p-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('avgScore')}: </span>
                <span className="font-bold text-brand-teal">
                  {i.summary?.avgTotal != null ? i.summary.avgTotal.toFixed(1) : t('noScores')}
                </span>
              </div>
              {i.summary && (
                <div className="text-muted-foreground">
                  {t('evaluatorsLabel')}: <span className="font-medium">{i.summary.count}</span>
                </div>
              )}
              {i.summary && i.summary.conflicts > 0 && (
                <div className="text-brand-gold">
                  {i.summary.conflicts} {t('conflictsNote')}
                </div>
              )}
            </div>

            {/* Per-item comment (used for single-item reject/return) */}
            {selected.size === 0 && (
              <Textarea
                placeholder={t('commentPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDetail(i)}>
                {t('details')}
              </Button>
              {decisionButtons.map((b) => (
                <Button
                  key={b.decision}
                  size="sm"
                  variant={b.variant}
                  disabled={pending || !quorumMet}
                  onClick={() => decide([i.id], b.decision)}
                >
                  <b.icon className="h-4 w-4" />
                  {b.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Detail modal (F-20) */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-brand-teal">{title(detail)}</CardTitle>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label={t('close')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Section label={t('problem')} body={detail.problem_statement} />
              <Section label={t('solution')} body={detail.proposed_solution} />
              <Section label={t('benefits')} body={detail.expected_benefits} />

              <div>
                <p className="mb-2 font-semibold text-brand-teal">{t('perCriterion')}</p>
                {detail.summary && Object.keys(detail.summary.perCriterion).length > 0 ? (
                  <ul className="space-y-1">
                    {Object.entries(detail.summary.perCriterion).map(([key, value]) => (
                      <li key={key} className="flex justify-between border-b border-border py-1">
                        <span>{te(`criteriaLabels.${key}`)}</span>
                        <span className="font-medium">{value.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('noScores')}</p>
                )}
              </div>

              {/* Individual evaluator scorecards (F-20) */}
              {detail.summary && detail.summary.scorecards.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold text-brand-teal">
                    {t('individualScores')}
                  </p>
                  <div className="space-y-3">
                    {detail.summary.scorecards.map((sc) => (
                      <div
                        key={sc.evaluatorId}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{sc.evaluatorName}</span>
                          {sc.conflict ? (
                            <span className="text-xs font-medium text-brand-gold">
                              {t('conflictsNote')}
                            </span>
                          ) : sc.totalScore != null ? (
                            <span className="text-sm font-semibold text-brand-teal">
                              {t('avgScore')}: {sc.totalScore.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                        {!sc.conflict && sc.criteriaScores && (
                          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {Object.entries(sc.criteriaScores).map(([key, value]) => (
                              <li
                                key={key}
                                className="flex justify-between text-xs text-muted-foreground"
                              >
                                <span>{te(`criteriaLabels.${key}`)}</span>
                                <span className="font-medium text-foreground">
                                  {value}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {sc.comments && (
                          <p className="mt-2 text-xs italic text-muted-foreground">
                            “{sc.comments}”
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-brand-teal">{label}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}
