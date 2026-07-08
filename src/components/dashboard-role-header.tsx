'use client';

/**
 * src/components/dashboard-role-header.tsx:1
 * Phase 12.1 — thin bar rendered directly under <LandingNav /> on every
 * role-based dashboard, hosting the RoleSwitcher (2+ roles only), the
 * current-location indicator (breadcrumb-style) and the dynamic RoleUserMenu.
 * Kept separate from LandingNav itself (which stays pre-login-agnostic) per
 * the brief's instruction to preserve LandingNav unchanged for brand
 * continuity.
 *
 * UX note (batch 07/26): the switcher is hidden entirely for single-role
 * users — no dropdown that would let them jump into dashboards they don't
 * have permission for. Only users with 2+ *actual* roles ever see it, and
 * even then only their own roles are listed.
 */
'use client';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { RoleSwitcher, type RoleOption } from '@/components/role-switcher';

type CrumbKey =
  | 'dashboard'
  | 'my-ideas'
  | 'ideas-new'
  | 'team'
  | 'level'
  | 'notifications'
  | 'settings'
  | 'evaluation'
  | 'committee';

const CRUMB_LABELS: Record<CrumbKey, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة أعمالي', en: 'My Dashboard' },
  'my-ideas': { ar: 'أفكاري', en: 'My Ideas' },
  'ideas-new': { ar: 'تقديم فكرة', en: 'Submit Idea' },
  team: { ar: 'فريقي', en: 'My Team' },
  level: { ar: 'مستواي', en: 'My Level' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  evaluation: { ar: 'قائمة التقييم', en: 'Evaluation Queue' },
  committee: { ar: 'اللجنة', en: 'Committee' },
};

function detectCrumb(pathname: string): CrumbKey {
  // Strip locale prefix if present.
  const p = pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
  if (p.startsWith('/my-ideas')) return 'my-ideas';
  if (p.startsWith('/ideas/new')) return 'ideas-new';
  if (p.startsWith('/team')) return 'team';
  if (p.startsWith('/profile/level') || p.startsWith('/profile')) return 'level';
  if (p.startsWith('/notifications')) return 'notifications';
  if (p.startsWith('/settings')) return 'settings';
  if (p.startsWith('/evaluation')) return 'evaluation';
  if (p.startsWith('/committee')) return 'committee';
  return 'dashboard';
}

export function DashboardRoleHeader({
  roles,
  activeRole,
}: {
  roles: RoleOption[];
  activeRole: string;
  displayName?: string;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const pathname = usePathname() ?? '/';
  const crumb = detectCrumb(pathname);
  const label = CRUMB_LABELS[crumb];

  return (
    <div className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Current location indicator (breadcrumb-style, active state). */}
        <div className="flex items-center gap-2 text-sm">
          <LayoutDashboard className="h-4 w-4 text-brand-teal" aria-hidden="true" />
          <span className="font-semibold text-brand-teal">{isAr ? label.ar : label.en}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Only rendered when the user actually holds 2+ roles. The user
              menu lives in the AppShell header now (persistent app nav), so it
              is intentionally not duplicated here. */}
          <RoleSwitcher roles={roles} activeRole={activeRole} />
        </div>
      </div>
    </div>
  );
}
