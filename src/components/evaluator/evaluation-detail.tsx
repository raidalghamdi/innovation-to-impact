'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { ArrowLeft, ArrowRight, Download, FileText, Users } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { EvRing, EvSuccessOverlay, EvToast } from '@/components/evaluator/ev-ui';
import { submitEvaluatorScore } from '@/app/[locale]/evaluator/actions';
import { EV_CRITERIA, type EvScores, type EvCriterion } from '@/lib/evaluator-criteria';

type Attachment = { id: string; filename: string; url: string | null; contentType: string | null };

type Props = {
  locale: string;
  ideaId: string;
  code: string | null;
  status: string;
  title: string;
  trackName: string | null;
  activityName: string | null;
  challengeName: string | null;
  description: string | null;
  submittedAt: string | null;
  participationType: 'individual' | 'team' | null;
  attachments: Attachment[];
  readOnly: boolean;
  existingScores: Partial<EvScores> | null;
  existingNotes: string | null;
};

export function EvaluationDetail(props: Props) {
  const { locale, ideaId, readOnly } = props;
  const t = useTranslations('evaluator');
  const isAr = locale === 'ar';
  const Back = isAr ? ArrowRight : ArrowLeft;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initScores = () => {
    const s = {} as Record<EvCriterion, number>;
    for (const k of EV_CRITERIA) s[k] = Number(props.existingScores?.[k] ?? 0);
    return s;
  };
  const [scores, setScores] = useState<Record<EvCriterion, number>>(initScores);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState(props.existingNotes ?? '');
  const [showSuccess, setShowSuccess] = useState(false);
  const [toast, setToast] = useState(false);

  const avg =
    EV_CRITERIA.reduce((sum, k) => sum + scores[k], 0) / EV_CRITERIA.length;
  const allTouched = readOnly || EV_CRITERIA.every((k) => touched[k]);

  function submit() {
    startTransition(async () => {
      const res = await submitEvaluatorScore({ ideaId, scores: scores as EvScores, notes });
      if (res.ok) setShowSuccess(true);
      else setToast(true);
    });
  }

  // Round 29 point 2: idea info card shows exactly seven fields — title,
  // supervisor approval status, event, track, challenge, code, submitted-at.
  // No other identity fields on this page.
  const infoRows: Array<{ label: string; value: string }> = [
    { label: t('infoSupervisorStatus'), value: supervisorStatus(props.status, isAr) },
    { label: t('infoEvent'), value: props.activityName ?? '—' },
    { label: t('infoTrack'), value: props.trackName ?? '—' },
    { label: t('infoChallenge'), value: props.challengeName ?? '—' },
    { label: t('infoCode'), value: props.code ?? '—' },
    {
      label: t('infoSubmittedAt'),
      value: props.submittedAt ? formatDateTime(props.submittedAt, locale) : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/evaluator/ideas" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <Back className="h-4 w-4" />
        {t('backToIdeas')}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          {/* Idea information card — seven fields only (Round 29 pt 2) */}
          <div className="ev-card p-6">
            <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{props.title}</h1>
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {infoRows.map((r) => (
                <div key={r.label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-semibold text-[var(--ink-faint)]">{r.label}</dt>
                  <dd className="text-sm font-medium text-[var(--ink)]">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Description — same content the innovator submitted */}
          <div className="ev-card p-6">
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">{t('blockDescription')}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--ink-soft)]">
              {props.description || '—'}
            </p>
          </div>

          {/* Attachments */}
          <div className="ev-card p-6">
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">{t('blockAttachments')}</h2>
            {props.attachments.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-faint)]">{t('noAttachments')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {props.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--gold-deep)]" />
                      <span className="truncate text-sm">{a.filename}</span>
                    </span>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--gold-deep)] hover:underline">
                        <Download className="h-3.5 w-3.5" />
                        {t('download')}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Team — participation type only, no names (Round 29 pt 3) */}
          <div className="ev-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[var(--ink)]">
              <Users className="h-5 w-5 text-[var(--ink-faint)]" />
              {t('blockTeam')}
            </h2>
            <p className="mt-3 text-sm text-[var(--ink)]">
              {props.participationType === 'team'
                ? t('participationTeam')
                : props.participationType === 'individual'
                  ? t('participationIndividual')
                  : '—'}
            </p>
          </div>
        </div>

        {/* Evaluation sidebar — layout unchanged per Round 29 pt 4 */}
        <div className="lg:col-span-1">
          <div className="ev-card sticky top-[132px] p-6">
            <div className="flex flex-col items-center">
              <EvRing value={avg} max={10} color="var(--gold)" label={avg.toFixed(1)} size={88} />
              <p className="mt-2 text-sm font-medium text-[var(--ink-soft)]">{t('overallScore')}</p>
            </div>

            <div className="mt-6 space-y-5">
              {EV_CRITERIA.map((k) => (
                <div key={k}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--ink)]">{t(`crit_${k}`)}</span>
                    <span className="ev-num text-sm text-[var(--gold-deep)]">{scores[k].toFixed(1)}</span>
                  </div>
                  <p className="mb-2 text-xs text-[var(--ink-faint)]">{t(`critHint_${k}`)}</p>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={scores[k]}
                    disabled={readOnly}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setScores((s) => ({ ...s, [k]: v }));
                      setTouched((tt) => ({ ...tt, [k]: true }));
                    }}
                    className="ev-slider"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-[var(--ink)]">{t('notesLabel')}</label>
              {readOnly ? (
                <pre className="mt-2 min-h-[80px] whitespace-pre-wrap rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] p-3 font-body text-sm text-[var(--ink-soft)]">
                  {notes || '—'}
                </pre>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2 min-h-[80px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white p-3 text-sm outline-none focus:border-[var(--gold)]"
                  placeholder={t('notesPlaceholder')}
                />
              )}
            </div>

            {readOnly ? (
              <div className="ev-pill-sage mt-5 w-full justify-center">{t('alreadySubmitted')}</div>
            ) : (
              <button
                onClick={submit}
                disabled={!allTouched || pending}
                className="ev-btn-gold mt-5 w-full"
              >
                {pending ? t('submitting') : t('submitEvaluation')}
              </button>
            )}
          </div>
        </div>
      </div>

      {showSuccess && (
        <EvSuccessOverlay
          title={t('successTitle')}
          subtitle={t('successBody')}
          onDone={() => router.push('/evaluator')}
        />
      )}
      <EvToast message={t('submitError')} show={toast} />
    </div>
  );
}

// Supervisor approval status — the evaluator needs to see whether the
// supervisor has approved the idea before it reached them. Any status past
// 'submitted'/'screening' is effectively "approved by supervisor" because the
// idea only gets assigned to an evaluator after supervisor approval.
function supervisorStatus(status: string, isAr: boolean): string {
  const approved = status === 'approved' || status === 'assigned' || status === 'evaluation';
  if (approved) return isAr ? 'مُعتمَدة من المشرف' : 'Approved by supervisor';
  if (status === 'screening') return isAr ? 'قيد فرز المشرف' : 'Under supervisor screening';
  if (status === 'submitted') return isAr ? 'بانتظار مراجعة المشرف' : 'Awaiting supervisor review';
  return status;
}
