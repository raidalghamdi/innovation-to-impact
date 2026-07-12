'use client';

import { useTranslations } from 'next-intl';
import type { StageState } from '@/lib/idea-journey';
import './idea-journey-timeline.css';

export type JourneyTimelineStage = {
  index: number;
  state: StageState;
  completedAtISO: string | null;
  label: { ar: string; en: string };
};

/**
 * Eight-stage idea journey Timeline, in two groups (program / post-program) with
 * a dashed divider between stage 5 and stage 6. Each stage reflects the idea's
 * real state: completed stages are green with a check, the current stage is gold
 * with its number, a stopped stage is red with its number, and upcoming stages
 * are a neutral outline. The connector fills green up to the last completed stage
 * (rose when the idea stopped).
 */
export function IdeaJourneyTimeline({
  stages,
}: {
  locale: string;
  stages: JourneyTimelineStage[];
  stopped?: boolean;
}) {
  const t = useTranslations('stages');
  const tj = useTranslations('ideaJourney');

  const segments = Math.max(stages.length - 1, 1);
  const stoppedIdx = stages.find((s) => s.state === 'stopped')?.index ?? null;
  let lastCompletedIdx = -1;
  for (const s of stages) if (s.state === 'completed') lastCompletedIdx = Math.max(lastCompletedIdx, s.index);
  const fillToIdx = stoppedIdx != null ? stoppedIdx : lastCompletedIdx;
  const fillFraction = Math.max(0, fillToIdx) / segments;
  const fillWidth = `calc(${fillFraction} * 91%)`;
  const fillColor = stoppedIdx != null ? 'var(--ij-stopped)' : 'var(--ij-completed)';

  const stateLabel = (state: StageState): string => tj(state);

  return (
    <div className="ij-track" role="list" aria-label={tj('sectionLabel')}>
      <div className="ij-group-heads">
        <div className="ij-group-head">{t('groupProgram')}</div>
        <div className="ij-group-head">{t('groupPostProgram')}</div>
      </div>
      <div className="ij-steps" dir="rtl">
        <div className="ij-track-line" />
        <div className="ij-track-line-fill" style={{ width: fillWidth, background: fillColor }} />
        <div className="ij-divider" />
        {stages.map((s) => {
          const n = s.index + 1;
          return (
            <div
              key={s.index}
              className={`ij-step ${s.state}`}
              role="listitem"
              aria-label={`${t(`s${n}` as any)} — ${stateLabel(s.state)}`}
            >
              <div className="ij-circle">
                <span className="ij-num">{n}</span>
              </div>
              <div className="ij-label">{t(`s${n}` as any)}</div>
              {s.state === 'stopped' && <div className="ij-stop-pill">{t('stoppedHere')}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
