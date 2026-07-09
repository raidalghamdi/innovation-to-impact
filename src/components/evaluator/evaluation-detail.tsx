'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { ArrowLeft, ArrowRight, Download, FileText, Play, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EvRing, EvSuccessOverlay, EvToast } from '@/components/evaluator/ev-ui';
import { submitEvaluatorScore } from '@/app/[locale]/evaluator/actions';
import { EV_CRITERIA, type EvScores, type EvCriterion } from '@/lib/evaluator-criteria';

type Attachment = { id: string; filename: string; url: string | null; contentType: string | null };
type Member = { name: string | null; isLeader: boolean };

type Props = {
  locale: string;
  ideaId: string;
  code: string | null;
  status: string;
  title: string;
  trackName: string | null;
  problem: string | null;
  solution: string | null;
  submittedAt: string | null;
  teamName: string | null;
  team: Member[];
  hasVideo: boolean;
  videoUrl: string | null;
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

  return (
    <div className="space-y-6">
      <Link href="/evaluator/ideas" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <Back className="h-4 w-4" />
        {t('backToIdeas')}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <div className="ev-card p-6">
            <div className="flex flex-wrap gap-2">
              <span className="ev-badge-sage">{statusLabel(props.status, isAr)}</span>
              {props.trackName && <span className="ev-badge-gold">{props.trackName}</span>}
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-[var(--ink)]">{props.title}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--ink-faint)]">
              {props.submittedAt && (
                <span className="ev-num">{t('submittedOn')}: {formatDate(props.submittedAt, locale)}</span>
              )}
              {props.code && <span className="ev-num">{props.code}</span>}
            </div>
          </div>

          {/* Video / pitch */}
          <div className="ev-card overflow-hidden">
            {props.hasVideo && props.videoUrl ? (
              <iframe src={props.videoUrl} title={props.title} className="aspect-video w-full" />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[var(--paper)] text-[var(--ink-faint)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]">
                  <Play className="h-5 w-5" />
                </span>
                <span className="text-sm">{t('noVideo')}</span>
              </div>
            )}
          </div>

          <Block title={t('blockProblem')}>{props.problem || '—'}</Block>
          <Block title={t('blockSolution')}>{props.solution || '—'}</Block>

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

          {/* Team */}
          <div className="ev-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[var(--ink)]">
              <Users className="h-5 w-5 text-[var(--ink-faint)]" />
              {t('blockTeam')} {props.teamName ? `— ${props.teamName}` : ''}
            </h2>
            {props.team.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-faint)]">{t('individualParticipation')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {props.team.map((m, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sage-soft)] text-xs font-bold text-[var(--sage)]">
                      {(m.name ?? '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm text-[var(--ink)]">{m.name ?? '—'}</span>
                    {m.isLeader && <span className="ev-badge-gold">{t('teamLeader')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Evaluation sidebar */}
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ev-card p-6">
      <h2 className="font-display text-lg font-bold text-[var(--ink)]">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--ink-soft)]">
        {children}
      </p>
    </div>
  );
}

function statusLabel(status: string, isAr: boolean): string {
  const ar: Record<string, string> = {
    submitted: 'مقدَّمة',
    screening: 'قيد الفرز',
    approved: 'مُعتمَدة',
    assigned: 'مُسندة',
    evaluation: 'قيد التقييم',
  };
  const en: Record<string, string> = {
    submitted: 'Submitted',
    screening: 'Screening',
    approved: 'Approved',
    assigned: 'Assigned',
    evaluation: 'Evaluation',
  };
  return (isAr ? ar[status] : en[status]) ?? status;
}
