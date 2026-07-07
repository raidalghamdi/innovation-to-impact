'use client';

/**
 * src/components/admin-back-nav.tsx
 * Client-side breadcrumb rendered inside AdminLayout. Reads the current
 * pathname via next/navigation (usePathname) instead of relying on request
 * headers, which are unreliable on Vercel's edge runtime — that was making
 * the "Back to Admin Hub" button disappear on production.
 *
 * Renders:
 *   [← Back to Admin Hub]                       [icon] Current page label
 *
 * Hidden entirely on the /admin hub index itself (no self-reference).
 */
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ArrowRight, LayoutDashboard } from 'lucide-react';

type Props = {
  locale: string;
  sectionLabels: Record<string, { ar: string; en: string }>;
};

export function AdminBackNav({ locale, sectionLabels }: Props) {
  const rawPath = usePathname() ?? '';
  // Strip leading locale segment.
  const pathname = rawPath.replace(/^\/(ar|en)(?=\/|$)/, '') || '/admin';

  // Only render on /admin/* SUB-pages, not on the hub itself.
  const isHubIndex = pathname === '/admin' || pathname === '/admin/';
  if (isHubIndex) return null;

  const parts = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean); // e.g. ['admin', 'cms']

  const isAr = locale === 'ar';
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  // Deepest segment name (skip the leading 'admin').
  const lastSeg = parts.length > 1 ? parts[parts.length - 1] : '';
  const labels = sectionLabels[lastSeg];
  const currentLabel = labels ? (isAr ? labels.ar : labels.en) : lastSeg.replace(/-/g, ' ');

  return (
    <nav
      aria-label={isAr ? 'مسار التنقّل' : 'Breadcrumb'}
      className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
    >
      <Link
        href={'/admin' as any}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-teal/30 bg-brand-teal-light/40 px-3 py-2 text-sm font-medium text-brand-teal transition hover:border-brand-teal hover:bg-brand-teal-light"
      >
        <BackArrow className="h-4 w-4" aria-hidden="true" />
        <span>{isAr ? 'العودة للوحة الإدارة' : 'Back to Admin Hub'}</span>
      </Link>
      {currentLabel && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-foreground">{currentLabel}</span>
        </div>
      )}
    </nav>
  );
}
