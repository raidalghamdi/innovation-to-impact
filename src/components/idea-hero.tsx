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
  teamMembers,
  teamName,
  canEdit,
  isReturned,
}: Props) {
  const isAr = locale === 'ar';
  const ts = useTranslations('stages');
  const t = useTranslations('ideas');
  const tc = useTranslations('common');

  const stageLabel = ts(`s${currentStage}` as any);
  const statusLabel = status
    ? isAr
      ? statusAr[status] ?? status
      : statusEn[status] ?? status
    : '';

  return (
    <section className="relative -mt-4 mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2E33] via-[#122E33] to-[#1B474D] text-white shadow-xl">
      <div className="px-6 pb-8 pt-8 sm:px-10 sm:pt-10">
        {/* Top row: code + status chip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-medium text-emerald-300">
              {statusLabel}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/80">
              {ideaCode} · {isAr ? 'المرحلة' : 'Stage'} {currentStage}
            </span>
          </div>
          <div className="text-xs uppercase tracking-wider text-white/50">
            {t('title')}
          </div>
        </div>

        {/* Big title */}
        <h1
          className="mt-5 max-w-4xl text-2xl font-bold leading-tight sm:text-3xl md:text-4xl lg:text-5xl"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {title}
        </h1>

        {/* Campaign (الفعالية) — labeled row */}
        {campaignName && (
          <div className="mt-6">
            <ChipCard label={t('campaign')} value={campaignName} />
          </div>
        )}

        {/* Chips row: track + challenge, side by side */}
        {(themeName || challengeName) && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {themeName && <ChipCard label={t('trackLabel')} value={themeName} />}
            {challengeName && <ChipCard label={t('challengeLabel')} value={challengeName} />}
          </div>
        )}

        {/* Team strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <TeamStrip members={teamMembers} teamName={teamName} isAr={isAr} />
        </div>

        {/* Horizontal timeline */}
        <div className="mt-8 rounded-xl bg-white/5 p-4 backdrop-blur">
          <StageTimelineHorizontal current={currentStage} dark />
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

function ChipCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
      <span className="shrink-0 text-xs uppercase tracking-wider text-white/60">{label}</span>
      <span className="min-w-0 break-words text-end text-sm font-medium">{value}</span>
    </div>
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
