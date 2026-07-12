'use client';

import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/utils';
import type { StageState } from '@/lib/idea-journey';
import './idea-journey-timeline.css';

export type JourneyTimelineStage = {
  index: number;
  state: StageState;
  completedAtISO: string | null;
  label: { ar: string; en: string };
};

/**
 * Dynamic six-stage idea journey Timeline. Reflects the idea's real state:
 * completed stages are solid sage with a check + timestamp, the current stage
 * pulses gold (or rust when the idea is stopped), and upcoming stages are dim.
 */
export function IdeaJourneyTimeline({
  locale,
  stages,
  stopped = false,
}: {
  locale: string;
  stages: JourneyTimelineStage[];
  stopped?: boolean;
}) {
  const t = useTranslations('ideaJourney');
  const isAr = locale === 'ar';

  const currentIndex = stages.find((s) => s.state === 'current')?.index ?? stages.length;
  const segments = Math.max(stages.length - 1, 1);
  const fillFraction = Math.min(Math.max(currentIndex, 0), stages.length) / segments;
  const fillWidth = `calc(${fillFraction} * 83.4%)`;
  const fillColor = stopped ? 'var(--ij-rust)' : 'var(--ij-sage-2)';

  const displayState = (s: JourneyTimelineStage): StageState | 'stopped' =>
    stopped && s.state === 'current' ? 'stopped' : s.state;

  const stateLabel = (state: StageState | 'stopped'): string =>
    state === 'completed'
      ? t('completed')
      : state === 'current'
        ? t('current')
        : state === 'stopped'
          ? t('stopped')
          : t('upcoming');

  return (
    <div className="ij-track" role="list" aria-label={t('sectionLabel')}>
      <div className="ij-steps" dir="rtl">
        <div className="ij-track-line" />
        <div className="ij-track-line-fill" style={{ width: fillWidth, background: fillColor }} />
        {stages.map((s) => {
          const state = displayState(s);
          const label = isAr ? s.label.ar : s.label.en;
          return (
            <div
              key={s.index}
              className={`ij-step ${state}`}
              role="listitem"
              aria-label={`${label} — ${stateLabel(state)}`}
            >
              <div className="ij-circle">
                <span className="ij-num">{s.index + 1}</span>
              </div>
              <div className="ij-label">{label}</div>
              {s.completedAtISO && state === 'completed' && (
                <div className="ij-time">{formatDate(s.completedAtISO, locale)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
