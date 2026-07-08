import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

// Idea lifecycle stages — s1..s8 map to the DB-stored stage indices 1..8.
// The pipeline now starts at idea submission (stage 1); the pre-idea
// strategic-framework stage (0) is no longer shown. Storage stays as-is.
const STAGE_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;
const DESC_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] as const;

export function StageTimeline({ current }: { current: number }) {
  const t = useTranslations('stages');
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:gap-2">
      {STAGE_KEYS.map((key, idx) => {
        // `base` is the DB stage this node represents (1..8).
        const base = idx + 1;
        const done = base < current;
        const active = base === current;
        const displayNumber = base;
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
