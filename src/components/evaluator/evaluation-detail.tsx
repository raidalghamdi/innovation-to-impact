'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  FileText,
  Hash,
  Route as RouteIcon,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
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
  updatedAt: string | null;
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

  // Round 29 v2 — hero holds only the four identity fields. Supervisor approval
  // status is implicit (the idea couldn't reach the evaluator otherwise), so no
  // badge is rendered. Submission timestamps live in their own card below.
  const heroFields: Array<{ icon: typeof CalendarDays; label: string; value: string }> = [
    { icon: CalendarDays, label: t('infoEvent'), value: props.activityName ?? '—' },
    { icon: RouteIcon, label: t('infoTrack'), value: props.trackName ?? '—' },
    { icon: Target, label: t('infoChallenge'), value: props.challengeName ?? '—' },
    { icon: Hash, label: t('infoCode'), value: props.code ?? '—' },
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
          {/* Hero — dark, brand-teal background. First anchor point on the
              page: idea title + the four identity fields (event / track /
              challenge / code). No supervisor status badge (implicit), no
              submission date (moved into its own card below). */}
          <section className="ev-hero overflow-hidden rounded-[var(--radius-lg,20px)] p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[var(--gold)]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                {t('heroKicker')}
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {props.title}
            </h1>
            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {heroFields.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="ev-hero-chip flex items-center gap-3 rounded-[var(--radius-sm)] border border-[rgba(224,168,46,0.32)] bg-[rgba(255,255,255,0.04)] px-4 py-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-white/55">
                      {label}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold text-white" title={value}>
                      {value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {/* Description */}
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

          {/* Team — participation type only */}
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

          {/* Submission metadata — dedicated card, placed after Team. Two
              rows separated by a hairline divider, styled after the innovator
              reference the user attached. */}
          <div className="ev-card p-6">
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">
              {t('blockSubmissionMeta')}
            </h2>
            <dl className="mt-4 divide-y divide-[var(--line)]">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-[var(--ink-soft)]">{t('metaSubmittedAt')}</dt>
                <dd className="text-sm font-medium text-[var(--ink)]">
                  {props.submittedAt ? formatDateTime(props.submittedAt, locale) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-[var(--ink-soft)]">{t('metaUpdatedAt')}</dt>
                <dd className="text-sm font-medium text-[var(--ink)]">
                  {props.updatedAt ? formatDateTime(props.updatedAt, locale) : '—'}
                </dd>
              </div>
            </dl>
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
