import { StatsBlockSkeleton } from '@/components/skeletons';

/**
 * Route-level loading UI for the landing page (/en, /ar).
 *
 * The homepage streams stats from Supabase; while that resolves Next.js
 * renders this file. We keep it minimal — a hero placeholder plus the KPI
 * grid — so the layout matches the real page and CLS stays at zero.
 */
export default function LandingLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        <div className="h-12 w-3/4 max-w-xl rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        <div className="h-4 w-2/3 max-w-lg rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 max-w-md rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        <div className="pt-4">
          <StatsBlockSkeleton />
        </div>
      </div>
    </div>
  );
}
