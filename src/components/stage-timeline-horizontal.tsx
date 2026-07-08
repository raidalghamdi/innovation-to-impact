'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Horizontal 9-stage timeline used inside the dark idea Hero. Renders each
 * stage as a numbered node connected by a track, with the current step
 * highlighted in the accent color and completed steps checked.
 *
 * `dark=true` swaps text colors for the dark hero background.
 */
export function StageTimelineHorizontal({
  current,
  dark = false,
}: {
  current: number;
  dark?: boolean;
}) {
  const t = useTranslations('stages');

  return (
    <ol
      className={cn(
        'grid grid-flow-col auto-cols-fr items-start gap-2 overflow-x-auto',
        'md:overflow-visible'
      )}
    >
      {Array.from({ length: 9 }, (_, idx) => {
        const done = idx < current;
        const active = idx === current;
        const displayNumber = idx + 1;
        const nextDone = idx + 1 < current;
        const trackColor = done
          ? 'bg-emerald-500'
          : active
            ? 'bg-amber-400/60'
            : dark
              ? 'bg-white/15'
              : 'bg-slate-200';
        return (
          <li key={idx} className="relative flex min-w-[80px] flex-col items-center">
            {/* Track segment (skip on last) */}
            {idx < 8 && (
              <div
                className={cn(
                  'absolute top-4 h-0.5 w-full',
                  nextDone ? 'bg-emerald-500' : trackColor
                )}
                style={{
                  insetInlineStart: '50%',
                  width: '100%',
                }}
                aria-hidden
              />
            )}
            {/* Node */}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm transition',
                done && 'border-emerald-500 bg-emerald-500 text-white',
                active && 'border-amber-400 bg-amber-400 text-slate-900',
                !done && !active && dark && 'border-white/25 bg-[#122E33] text-white/60',
                !done && !active && !dark && 'border-slate-300 bg-white text-slate-500'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-4 w-4" /> : displayNumber}
            </div>
            {/* Label */}
            <span
              className={cn(
                'mt-2 line-clamp-2 max-w-[100px] px-1 text-center text-[11px] leading-tight',
                active && (dark ? 'font-semibold text-amber-200' : 'font-semibold text-amber-700'),
                done && (dark ? 'text-emerald-200' : 'text-emerald-700'),
                !done && !active && (dark ? 'text-white/60' : 'text-slate-500')
              )}
              title={t(`d${idx}` as any)}
            >
              {t(`s${idx}` as any)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
