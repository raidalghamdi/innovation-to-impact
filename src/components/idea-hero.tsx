'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AlertTriangle } from 'lucide-react';
import { StageTimelineHorizontal } from '@/components/stage-timeline-horizontal';
import { formatDate } from '@/lib/utils';

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
  ideaCode,
  title,
  currentStage,
  status,
  campaignName,
  themeName,
  challengeName,
  participationType,
  submittedAt,
  teamMembers,
  teamName,
  canEdit,
  isReturned,
}: Props) {
  const isAr = locale === 'ar';
  const ts = useTranslations('stages');
  const t = useTranslations('ideas');

  const STOPPED_STATUSES = new Set(['returned', 'rejected', 'on_hold', 'withdrawn']);
  const isStopped = STOPPED_STATUSES.has(status);

  const statusLabel = status
    ? isAr
      ? statusAr[status] ?? status
      : statusEn[status] ?? status
    : '';

  // Unified chip strip. Each chip is a small uppercase-ish label above a value
  // line. Chips with an empty value are dropped so we never render a dangling
  // label. Order matches the Round 18 spec.
  const chips: Array<{ key: string; label: string; value: string; accent?: boolean }> = [
    { key: 'status', label: isAr ? 'الحالة' : 'Status', value: statusLabel, accent: true },
    { key: 'code', label: isAr ? 'رقم الفكرة' : 'Code', value: ideaCode ?? '' },
    {
      key: 'stage',
      label: isAr ? 'المرحلة' : 'Stage',
      value: currentStage ? `${currentStage}` : '',
    },
    {
      key: 'participation',
      label: isAr ? 'نوع المشاركة' : 'Participation',
      value:
        participationType === 'team'
          ? isAr
            ? 'فريق'
            : 'Team'
          : isAr
            ? 'فردي'
            : 'Individual',
    },
    { key: 'track', label: isAr ? 'المسار' : 'Track', value: themeName ?? '' },
    { key: 'activity', label: isAr ? 'الفعالية' : 'Activity', value: campaignName ?? '' },
    { key: 'challenge', label: isAr ? 'التحدي' : 'Challenge', value: challengeName ?? '' },
    {
      key: 'submitted',
      label: isAr ? 'تاريخ التقديم' : 'Submitted',
      value: submittedAt ? formatDate(submittedAt, locale) : '',
    },
  ].filter((c) => c.value && c.value.trim().length > 0);

  return (
    <section className="relative -mt-4 mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2E33] via-[#122E33] to-[#1B474D] text-white shadow-xl">
      <div className="px-6 pb-8 pt-8 sm:px-10 sm:pt-10">
        {/* Eyebrow */}
        <div className="text-xs uppercase tracking-wider text-white/50">{t('title')}</div>

        {/* Big title */}
        <h1
          className="mt-3 max-w-4xl text-2xl font-bold leading-tight sm:text-3xl md:text-4xl lg:text-5xl"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {title}
        </h1>

        {/* Chip strip — label over value, empty chips dropped, wraps on
            narrow screens. Contrast tuned for the dark hero background. */}
        <div className="mt-6 flex flex-wrap gap-3">
          {chips.map((c) => (
            <div
              key={c.key}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5"
            >
              <div className="text-[11px] uppercase tracking-wider text-white/55">{c.label}</div>
              <div
                className={`mt-0.5 text-sm font-semibold ${
                  c.accent ? 'text-emerald-300' : 'text-white'
                }`}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Team strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <TeamStrip members={teamMembers} teamName={teamName} isAr={isAr} />
        </div>

        {/* Info boxes + submitter card */}
        <div className="mt-6 grid gap-[18px] items-stretch" style={{ gridTemplateColumns: 'minmax(0, 720px) minmax(0, 1fr)' }}>
          <div className="flex flex-col gap-[10px]">
            {/* Row 1: track */}
            {themeName && (
              <div className="flex items-center gap-[14px] rounded-xl border border-white/10 px-5 py-3.5 min-h-[52px]">
                <span className="text-[12.5px] font-medium text-white/50 whitespace-nowrap min-w-[62px]">
                  {isAr ? 'المسار' : 'Track'}
                </span>
                <span className="w-px self-stretch bg-white/10 my-0.5" />
                <span className="flex-1 inline-flex items-center gap-2.5 text-[15px] font-medium text-white/95 text-right">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
                    <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
                  </svg>
                  {themeName}
                </span>
              </div>
            )}
            {/* Row 2: campaign + challenge */}
            <div className="grid gap-[10px] grid-cols-1 sm:grid-cols-2">
              {campaignName && (
                <div className="flex items-center gap-[14px] rounded-xl border border-white/10 px-5 py-3.5 min-h-[52px]">
                  <span className="text-[12.5px] font-medium text-white/50 whitespace-nowrap min-w-[62px]">
                    {isAr ? 'الفعالية' : 'Campaign'}
                  </span>
                  <span className="w-px self-stretch bg-white/10 my-0.5" />
                  <span className="flex-1 inline-flex items-center gap-2.5 text-[15px] font-medium text-white/95 text-right">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    {campaignName}
                  </span>
                </div>
              )}
              {challengeName && (
                <div className="flex items-center gap-[14px] rounded-xl border border-white/10 px-5 py-3.5 min-h-[52px]">
                  <span className="text-[12.5px] font-medium text-white/50 whitespace-nowrap min-w-[62px]">
                    {isAr ? 'التحدي' : 'Challenge'}
                  </span>
                  <span className="w-px self-stretch bg-white/10 my-0.5" />
                  <span className="flex-1 inline-flex items-center gap-2.5 text-[15px] font-medium text-white/95 text-right">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/55 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                    {challengeName}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Submitter card */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 flex flex-col justify-center gap-1.5">
            <div className="text-[11.5px] font-medium text-white/45 tracking-wide">
              {isAr ? 'مقدّم الفكرة' : 'Submitter'}
              {participationType === 'team' && (isAr ? ' — قائد الفريق' : ' — team lead')}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white font-extrabold text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#3FBAC8 0%,#2288a8 100%)' }}>
                {(teamMembers.find(m => m.is_leader)?.full_name || teamMembers[0]?.full_name || '?').charAt(0)}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="font-extrabold text-[13.5px] leading-tight text-white/95">
                  {teamMembers.find(m => m.is_leader)?.full_name || teamMembers[0]?.full_name || (isAr ? 'غير محدد' : 'Unknown')}
                </div>
                {teamMembers.find(m => m.is_leader)?.role_title && (
                  <div className="text-[11px] text-white/50 leading-tight truncate">
                    {teamMembers.find(m => m.is_leader)?.role_title}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-white/55">
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border" style={{ background: 'rgba(63,186,200,0.15)', color: '#8fdae4', borderColor: 'rgba(63,186,200,0.30)' }}>
                {participationType === 'team'
                  ? (isAr ? `فريق · ${teamMembers.length} أعضاء` : `Team · ${teamMembers.length} members`)
                  : (isAr ? 'فرد' : 'Individual')}
              </span>
              {submittedAt && (
                <span>
                  {isAr ? 'تاريخ التقديم: ' : 'Submitted: '}
                  <strong className="text-white/95 font-semibold">{formatDate(submittedAt, locale)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Horizontal timeline */}
        <div className="mt-4">
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

function TeamStrip({
  members,
  teamName,
  isAr,
}: {
  members: TeamMember[];
  teamName: string | null;
  isAr: boolean;
}) {
  if (!members.length) return <div />;
  const shown = members.slice(0, 5);
  const remaining = members.length - shown.length;
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {shown.map((m) => (
          <div
            key={m.id}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#122E33] bg-gradient-to-br from-teal-400 to-cyan-500 text-xs font-bold text-white"
            title={m.full_name ?? ''}
          >
            {initial(m.full_name)}
          </div>
        ))}
        {remaining > 0 && (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#122E33] bg-white/20 text-xs font-bold text-white">
            +{remaining}
          </div>
        )}
      </div>
      <div className="text-xs text-white/80">
        <div className="font-medium text-white">
          {teamName ?? (isAr ? 'الفريق' : 'Team')}
        </div>
        <div className="text-white/60">
          {members.length} {isAr ? 'أعضاء' : 'members'}
        </div>
      </div>
    </div>
  );
}

function initial(name: string | null): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
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
