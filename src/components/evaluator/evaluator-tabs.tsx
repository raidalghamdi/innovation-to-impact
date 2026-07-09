'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

type Props = {
  unread: number;
};

/**
 * Evaluator secondary navigation. Renders inside the unified platform
 * <AppShell> (same header/footer/fonts as the rest of the platform), so this
 * only provides the role-scoped tab row. Active tab is derived from the
 * locale-stripped pathname supplied by next-intl routing.
 */
export function EvaluatorTabs({ unread }: Props) {
  const t = useTranslations('evaluator');
  const pathname = usePathname();
  const hasUnread = unread > 0;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const tabs = [
    { href: '/evaluator', label: t('navDashboard'), exact: true },
    { href: '/evaluator/my-evaluations', label: t('navEvaluations') },
    { href: '/evaluator/level', label: t('navLevel') },
    { href: '/evaluator/notifications', label: t('navNotifications'), dot: hasUnread },
    { href: '/evaluator/settings', label: t('navSettings') },
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
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--rust)]" />}
            </span>
          </Link>
        ))}
        <Link href="/evaluator/ideas" className="ev-btn-gold ms-auto my-2 shrink-0 text-sm">
          {t('startEvaluating')}
        </Link>
      </div>
    </nav>
  );
}
