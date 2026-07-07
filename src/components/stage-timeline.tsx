import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

// Idea lifecycle stages — s0..s8 are the DB-stored zero-based indices. The
// UI numbers users see starts at 1 (idx + 1), so "Stage 1" is the first step
// in the pipeline, not "Stage 0". Storage stays zero-based (never mutate).
const STAGE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;
const DESC_KEYS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] as const;

export function StageTimeline({ current }: { current: number }) {
  const t = useTranslations('stages');
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:gap-2">
      {STAGE_KEYS.map((key, idx) => {
        const done = idx < current;
        const active = idx === current;
        // Display value is 1-based so users see "1…9", never "0".
        const displayNumber = idx + 1;
        return (
          <li
            key={key}
            title={t(DESC_KEYS[idx])}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
              active && 'border-brand-teal bg-brand-teal-light font-medium text-brand-teal',
              done && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              !done && !active && 'border-border bg-card text-muted-foreground hover:border-brand-teal/40'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                active && 'bg-brand-teal text-white',
                done && 'bg-emerald-600 text-white',
                !done && !active && 'bg-muted text-muted-foreground'
              )}
              aria-label={`Stage ${displayNumber}`}
            >
              {done ? <Check className="h-3 w-3" /> : displayNumber}
            </span>
            <span className="whitespace-nowrap">{t(key)}</span>
          </li>
        );
      })}
    </ol>
  );
}
