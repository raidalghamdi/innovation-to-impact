'use client';

/**
 * src/components/dashboard-role-header.tsx:1
 * Phase 12.1 — thin bar rendered directly under <LandingNav /> on every
 * role-based dashboard, hosting the RoleSwitcher (2+ roles only) and the
 * dynamic RoleUserMenu. Kept separate from LandingNav itself (which stays
 * pre-login-agnostic) per the brief's instruction to preserve LandingNav
 * unchanged for brand continuity.
 */
import { RoleSwitcher, type RoleOption } from '@/components/role-switcher';
import { RoleUserMenu } from '@/components/role-user-menu';

export function DashboardRoleHeader({
  roles,
  activeRole,
  displayName,
}: {
  roles: RoleOption[];
  activeRole: string;
  displayName: string;
}) {
  return (
    <div className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <RoleSwitcher roles={roles} activeRole={activeRole} />
        <RoleUserMenu displayName={displayName} activeRole={activeRole} />
      </div>
    </div>
  );
}
