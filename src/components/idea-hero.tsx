'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AlertTriangle } from 'lucide-react';
import { StageTimelineHorizontal } from '@/components/stage-timeline-horizontal';

type TeamMember = {
  id: string;
  full_name: string | null;
  role_title: string | null;
  is_leader: boolean;
};

type Props = {
  locale: string;
  ideaId: string;
  ideaCode: string | null;
  title: string;
  currentStage: number;
  status: string;
  campaignName: string | null;
  themeName: string | null;
  challengeName: string | null;
  participationType: 'individual' | 'team';
  submittedAt: string | null;
  teamMembers: TeamMember[];
  teamName: string | null;
  canEdit: boolean;
  isReturned: boolean;
};

/**
 * Dark hero + horizontal timeline for idea details.
 *
 * Layout matches the reference design: dark banner, small chips, large title,
 * team avatars strip, export buttons, and a horizontal timeline that spans the
 * full 9-stage lifecycle (IDs match `stages` i18n namespace).
 *
 * The Edit button only renders when the idea is in a state the innovator can
 * edit (returned, or their own draft) — passed as `canEdit`.
 */
export function IdeaHero({
  locale,
  ideaId,
  title,
  currentStage,
  status,
  campaignName,
  themeName,
  challengeName,
  canEdit,
  isReturned,
}: Props) {
  const isAr = locale === 'ar';
  const t = useTranslations('ideas');

  const STOPPED_STATUSES = new Set(['returned', 'rejected', 'on_hold', 'withdrawn']);
  const isStopped = STOPPED_STATUSES.has(status);

  const statusLabel = status
    ? isAr
      ? statusAr[status] ?? status
      : statusEn[status] ?? status
    : '';

  // Status badge tone: rose = stopped, emerald = approved, gold/amber =
  // in-progress. Uses existing framework palette tokens only (no new hex).
  const statusBadgeClass = isStopped
    ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
    : status === 'approved'
      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
      : 'border-amber-400/40 bg-amber-500/15 text-amber-200';

  const fields: Array<{ key: string; label: string; value: string; icon: JSX.Element }> = [
    {
      key: 'activity',
      label: t('activityLabel'),
      value: campaignName ?? '',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      key: 'track',
      label: t('trackLabel'),
      value: themeName ?? '',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
          <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
        </svg>
      ),
    },
    {
      key: 'challenge',
      label: t('challengeLabel'),
      value: challengeName ?? '',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
          <circle cx="12" cy="12" r="10" />
          <path d="M6 9l6 6 6-6" />
        </svg>
      ),
    },
  ].filter((f) => f.value && f.value.trim().length > 0);

  return (
    <section className="relative -mt-4 mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2E33] via-[#122E33] to-[#1B474D] text-white shadow-xl">
      <div className="px-6 pb-8 pt-8 sm:px-10 sm:pt-10">
        {/* Status badge — inline-start (top-right in RTL, top-left in LTR) */}
        <div className="flex">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Big title */}
        <h1
          className="mt-4 max-w-4xl text-2xl font-bold leading-tight sm:text-3xl md:text-4xl lg:text-5xl"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {title}
        </h1>

        {/* Activity / Track / Challenge chips — width fits content.
            Row 1: activity alone. Row 2: track + challenge side-by-side.
            Each chip hidden when its value is empty. */}
        {fields.length > 0 && (
          <div className="mt-6 flex flex-col gap-[10px] items-start">
            {(() => {
              const activity = fields.find((f) => f.key === 'activity');
              const track = fields.find((f) => f.key === 'track');
              const challenge = fields.find((f) => f.key === 'challenge');
              const renderChip = (f: (typeof fields)[number]) => (
                <div
                  key={f.key}
                  className="inline-flex w-fit max-w-full items-center gap-[14px] rounded-xl border border-white/10 px-5 py-3.5 min-h-[52px]"
                >
                  <span className="text-[12.5px] font-medium text-white/50 whitespace-nowrap min-w-[62px]">
                    {f.label}
                  </span>
                  <span className="w-px self-stretch bg-white/10 my-0.5" />
                  <span className="inline-flex items-center gap-2.5 text-[15px] font-medium text-white/95">
                    {f.icon}
                    <span className="break-words">{f.value}</span>
                  </span>
                </div>
              );
              return (
                <>
                  {activity && renderChip(activity)}
                  {(track || challenge) && (
                    <div className="flex flex-wrap gap-[10px]">
                      {track && renderChip(track)}
                      {challenge && renderChip(challenge)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Horizontal timeline */}
        <div className="mt-6">
          <StageTimelineHorizontal current={currentStage} isStopped={isStopped} />
        </div>

        {/* Returned-idea banner */}
        {isReturned && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <div>
                <div className="font-semibold text-amber-200">
                  {isAr ? 'تمت إعادة الفكرة للتعديل' : 'This idea was returned for edits'}
                </div>
                <div className="text-xs text-white/70">
                  {isAr
                    ? 'راجع ملاحظات المشرف أدناه وحدّث الحقول المطلوبة.'
                    : 'Review the supervisor’s notes below and update the required sections.'}
                </div>
              </div>
            </div>
            {canEdit && (
              <Link
                href={`/ideas/${ideaId}/edit`}
                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
              >
                {isAr ? 'ابدأ التعديل' : 'Start editing'}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const statusAr: Record<string, string> = {
  draft: 'مسودّة',
  submitted: 'مقدَّمة',
  screening: 'قيد الفرز',
  returned: 'مُعادة للتعديل',
  approved: 'مُعتمَدة',
  assigned: 'مُسندة',
  evaluation: 'قيد التقييم',
  rejected: 'مرفوضة',
  withdrawn: 'مسحوبة',
};
const statusEn: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  screening: 'Screening',
  returned: 'Returned',
  approved: 'Approved',
  assigned: 'Assigned',
  evaluation: 'Evaluation',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
