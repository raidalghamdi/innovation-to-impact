import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const STAGE_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;

/**
 * Compact 9-stage pipeline indicator (0..8) with the current stage highlighted.
 *
 * On mobile it renders as a horizontally scrollable row of pills so the entire
 * pipeline stays visible without wrapping awkwardly. On >=sm it wraps naturally.
 */
export function PipelineIndicator({ current }: { current: number }) {
  const t = useTranslations('stages');
  const tc = useTranslations('common');
  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {tc('pipeline')}
      </p>
      <ol
        role="list"
        className="-mx-1 flex snap-x snap-mandatory items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {STAGE_KEYS.map((key, idx) => {
          const base = idx + 1;
          const done = base < current;
          const active = base === current;
          return (
            <li
              key={key}
              title={`${base}. ${t(key)}`}
              className={cn(
                'flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                active && 'border-brand-teal bg-brand-teal text-white shadow-sm',
                done && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                !done && !active && 'border-border bg-card text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                  active && 'bg-white/25 text-white',
                  done && 'bg-emerald-600 text-white',
                  !done && !active && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : base}
              </span>
              <span className="whitespace-nowrap">{t(key)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
