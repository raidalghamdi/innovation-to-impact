import { AppShell } from '@/components/app-shell';
import { StagesListSkeleton } from '@/components/skeletons';

/**
 * Route-level loading UI for /stages. Rendered by Next.js while the real
 * `page.tsx` (with its server-side translations + data) is streaming.
 * Uses `AppShell` so the header/sidebar don't flash into place when the
 * real page mounts.
 */
export default function StagesLoading() {
  return (
    <AppShell>
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="space-y-3">
          <div className="h-8 w-64 rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
          <div className="h-4 w-96 max-w-full rounded-md bg-brand-teal-light/60 motion-safe:animate-pulse" />
        </div>
        <StagesListSkeleton />
      </div>
    </AppShell>
  );
}
