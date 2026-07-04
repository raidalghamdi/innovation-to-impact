import { AppShell } from '@/components/app-shell';
import { PipelineSkeleton } from '@/components/skeletons';

/**
 * Route-level loading UI for /dashboard. Renders while the real dashboard
 * server component fetches the current user, their ideas, and the pipeline
 * counts. Same AppShell wrapper as the real page keeps chrome stable.
 */
export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="space-y-3">
          <div className="h-8 w-56 rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
          <div className="h-4 w-80 max-w-full rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        </div>
        <PipelineSkeleton />
      </div>
    </AppShell>
  );
}
