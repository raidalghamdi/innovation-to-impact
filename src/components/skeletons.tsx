import { cn } from '@/lib/utils';

/**
 * Base pulsing block used by all skeletons.
 *
 * - Uses `motion-safe:` so users with `prefers-reduced-motion: reduce` get a
 *   static placeholder instead of the pulse animation.
 * - Muted brand-teal tint keeps the placeholder visually consistent with the
 *   loaded state without shouting for attention.
 */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse',
        className,
      )}
    />
  );
}

/**
 * Placeholder for the homepage stats block (KPI grid rendered above the fold
 * on `/en` and `/ar`). Renders 4 KPI card silhouettes matching the real
 * `KPICard` proportions so the layout does not shift when data arrives.
 */
export function StatsBlockSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-brand-teal-light/70 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-full space-y-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-8 w-32" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
            <SkeletonBlock className="h-9 w-9 rounded-full" />
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Placeholder for the /stages listing page — nine stage cards with title,
 * description and meta lines. Matches the real stage card silhouette.
 */
export function StagesListSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-brand-teal-light/70 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
          <div className="mt-4 space-y-2">
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
          <div className="mt-5 flex items-center gap-2">
            <SkeletonBlock className="h-6 w-16 rounded-full" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Placeholder for the dashboard pipeline (9-stage flow: s0..s8) plus the
 * summary counts row beneath it. Mirrors the compact pill layout used by
 * `PipelineIndicator` on the real page.
 */
export function PipelineSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="space-y-6"
    >
      <div>
        <SkeletonBlock className="mb-3 h-3 w-20" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-brand-teal-light/70 bg-white p-4 shadow-sm"
          >
            <SkeletonBlock className="mb-2 h-3 w-16" />
            <SkeletonBlock className="h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-brand-teal-light/70 bg-white p-5 shadow-sm">
        <SkeletonBlock className="mb-4 h-4 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-2 flex-1" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
