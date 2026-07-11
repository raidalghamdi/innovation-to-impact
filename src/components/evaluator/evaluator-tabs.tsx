'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

type Props = {
  // Kept in the signature to preserve the existing layout call site, but no
  // longer used to render a dot on a Notifications tab — the tab was removed
  // in Round 27 because notifications are only reached from the header bell.
  unread?: number;
};

/**
 * Evaluator secondary navigation. Renders inside the unified platform
 * <AppShell> (same header/footer/fonts as the rest of the platform), so this
 * only provides the role-scoped tab row. Active tab is derived from the
 * locale-stripped pathname supplied by next-intl routing.
 *
 * Round 27 changes:
 *   • Removed the Notifications tab (bell in the header is the sole entry).
 *   • Removed the Settings tab (still available from the avatar dropdown).
 *   • Added a dedicated "Evaluation queue" tab pointing at /evaluator/ideas,
 *     which is the full searchable/filterable list — promoted out of the
 *     old "quick actions" grid because it's the evaluator's core surface.
 *   • Removed the trailing gold "Start evaluating" button so there's exactly
 *     ONE gold CTA on the dashboard (the one inside the hero card).
 *   • "My Evaluations" → "Completed Evaluations" (unified naming).
 */
export function EvaluatorTabs(_props: Props) {
  const t = useTranslations('evaluator');
  const pathname = usePathname();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const tabs = [
    { href: '/evaluator', label: t('navDashboard'), exact: true },
    { href: '/evaluator/ideas', label: t('navQueue') },
    { href: '/evaluator/my-evaluations', label: t('navCompleted') },
    { href: '/evaluator/level', label: t('navLevel') },
  ];

  return (
    <nav className="mb-8 border-b border-[var(--line)]">
      <div className="flex items-center gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href as any}
            className="ev-tab"
            data-active={isActive(tab.href, tab.exact)}
          >
            <span className="inline-flex items-center gap-1.5">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
