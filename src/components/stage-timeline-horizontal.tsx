'use client';

import { useTranslations } from 'next-intl';
import './stage-timeline-horizontal.css';

type StageState = 'done' | 'current' | 'stopped' | 'upcoming';

export function StageTimelineHorizontal({
  current,
  isStopped = false,
}: {
  current: number;
  isStopped?: boolean;
}) {
  const t = useTranslations('stages');

  // Determine state per stage 1..8
  const stateFor = (n: number): StageState => {
    if (isStopped && n === current) return 'stopped';
    if (n < current) return 'done';
    if (n === current) return 'current';
    return 'upcoming';
  };

  // How much of the connector line is "done" (0..7 segments between 8 circles)
  // If stopped: fill up to the stopped stage - 0.5, in rust.
  const fillCount = isStopped ? Math.max(0, current - 1) - 0.5 : current - 1 - 0.5;
  const fillWidthCalc = `calc((${Math.max(fillCount, 0)}/7) * 91%)`;
  const fillColor = isStopped ? 'var(--st-rust)' : 'var(--st-sage-2)';

  return (
    <div className="st-track">
      <div className="st-group-heads">
        <div className="st-group-head">{t('groupProgram')}</div>
        <div className="st-group-head">{t('groupPostProgram')}</div>
      </div>
      <div className="st-steps" dir="rtl">
        <div className="st-track-line" />
        <div className="st-track-line-fill" style={{ width: fillWidthCalc, background: fillColor }} />
        <div className="st-divider" />
        {Array.from({ length: 8 }, (_, i) => {
          const n = i + 1;
          const state = stateFor(n);
          const key = `s${n}` as const;
          return (
            <div key={n} className={`st-step ${state}`}>
              <div className="st-circle">
                <span className="st-num">{n}</span>
              </div>
              <div className="st-label">{t(key)}</div>
              {state === 'stopped' && (
                <div className="st-stop-pill">{t('stoppedHere')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
