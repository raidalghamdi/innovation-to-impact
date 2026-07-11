import {
  User,
  Bell,
  LogOut,
  Lightbulb,
  PlusCircle,
  ClipboardList,
  CheckCircle2,
  Gavel,
  History,
  Users2,
  ShieldCheck,
  FileBarChart,
  UserCog,
  Shapes,
  Upload,
  SlidersHorizontal,
  Star,
  LayoutDashboard,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Mail,
  type LucideIcon,
} from 'lucide-react';

/**
 * src/lib/menu-for-role.ts:1
 * Single source of truth for the header avatar dropdown. Items depend on the
 * active role (innovation.roles.code), on top of a common base shared by every
 * role. hrefs are locale-relative (no /[locale] prefix — the consuming
 * component uses the routing-aware <Link>).
 *
 * UX note (batch 07/26): the menu is *unified* across all dashboard pages —
 * users see the same items whether they're on the overview or a sub-page.
 * "Profile" was removed to eliminate the duplicate with "Settings" (kept
 * "Settings" per the note in the ticket).
 */

export type MenuItem = {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
};

// Common tail: notifications + settings + always the dashboard link so the
// user has a one-tap way back to Overview from any deep page.
const DASHBOARD_ITEM: MenuItem = {
  href: '/dashboard',
  labelAr: 'لوحة أعمالي',
  labelEn: 'My Dashboard',
  icon: LayoutDashboard,
};

// Supervisor: 'لوحة أعمالي' points to the supervisor console, not the shared
// /dashboard route (which is submitter-oriented).
const SUPERVISOR_HUB_ITEM: MenuItem = {
  href: '/supervisor',
  labelAr: 'لوحة أعمالي',
  labelEn: 'My Dashboard',
  icon: LayoutDashboard,
};

// Admin never has a personal "my dashboard" — the console IS the dashboard.
const ADMIN_HUB_ITEM: MenuItem = {
  href: '/admin',
  labelAr: 'لوحة الإدارة',
  labelEn: 'Admin Hub',
  icon: LayoutDashboard,
};

const TAIL_ITEMS: MenuItem[] = [
  { href: '/notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Bell },
  { href: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: SettingsIcon },
];

// Role → dropdown items MUST match the canonical Role enum in src/lib/roles.ts
// ('submitter' | 'evaluator' | 'judge' | 'admin'). We also keep aliases
// ('innovator' → submitter, 'committee' → judge, 'supervisor' → evaluator's
// team-lead variant) so the same menu works if a caller passes an older role
// code returned from user_profiles/user_roles.
const SUBMITTER_ITEMS: MenuItem[] = [
  { href: '/my-ideas', labelAr: 'أفكاري', labelEn: 'My Ideas', icon: Lightbulb },
  { href: '/ideas/new', labelAr: 'قدّم فكرة', labelEn: 'Submit Idea', icon: PlusCircle },
  { href: '/profile/level', labelAr: 'مستواي', labelEn: 'My Level', icon: Star },
];

const EVALUATOR_ITEMS: MenuItem[] = [
  { href: '/evaluator', labelAr: 'مساحة المقيّم', labelEn: 'Evaluator Workspace', icon: LayoutDashboard },
  { href: '/evaluator/my-evaluations', labelAr: 'التقييمات المخصّصة لي', labelEn: 'My Evaluations', icon: ClipboardList },
  { href: '/evaluator/my-evaluations?filter=completed', labelAr: 'التقييمات المكتملة', labelEn: 'Completed Evaluations', icon: CheckCircle2 },
  { href: '/evaluator/level', labelAr: 'مستواي', labelEn: 'My Level', icon: Star },
];

// Evaluator-specific tail overrides — route Notifications and Settings to the
// themed evaluator equivalents (/evaluator/notifications, /evaluator/settings)
// instead of the global platform pages, so the evaluator never leaves the
// unified evaluator design (ev-root, gold/ink tokens, EvaluatorTabs).
const EVALUATOR_TAIL: MenuItem[] = [
  { href: '/evaluator/notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Bell },
  { href: '/evaluator/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: SettingsIcon },
];

const JUDGE_ITEMS: MenuItem[] = [
  { href: '/committee', labelAr: 'القرارات المعلّقة', labelEn: 'Pending Decisions', icon: Gavel },
  { href: '/committee?filter=history', labelAr: 'سجل القرارات', labelEn: 'Decision History', icon: History },
];

const ADMIN_ITEMS: MenuItem[] = [
  { href: '/admin/users', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: UserCog },
  { href: '/admin/roster', labelAr: 'الأدوار والدعوات', labelEn: 'Roster & Invitations', icon: UsersIcon },
  { href: '/admin/invitation-templates', labelAr: 'قوالب الدعوات', labelEn: 'Invitation Templates', icon: Mail },
  { href: '/admin/roles', labelAr: 'كتالوج الأدوار', labelEn: 'Roles Catalog', icon: Shapes },
  { href: '/admin/employees/import', labelAr: 'استيراد الموظفين', labelEn: 'Employees Import', icon: Upload },
  { href: '/admin/analytics', labelAr: 'تحليلات المشرف', labelEn: 'Analytics', icon: FileBarChart },
  { href: '/admin/backup', labelAr: 'النسخ الاحتياطي', labelEn: 'Backup', icon: Upload },
  { href: '/admin/settings', labelAr: 'إعدادات المنصة', labelEn: 'Platform Settings', icon: SlidersHorizontal },
  { href: '/admin/audit', labelAr: 'سجلات التدقيق', labelEn: 'Audit Logs', icon: FileBarChart },
  { href: '/admin/email-log', labelAr: 'سجل البريد', labelEn: 'Email Log', icon: Mail },
];

// Supervisor menu: intentionally minimal per Round 25 clarification —
// 'My Dashboard' (as SUPERVISOR_HUB_ITEM) + Notifications + Settings. No
// evaluator-style 'My evaluations / Completed evaluations' entries, no
// sector/analytics deep links.
const SUPERVISOR_ITEMS: MenuItem[] = [];

const ROLE_ITEMS: Record<string, MenuItem[]> = {
  // canonical Role enum values
  submitter: SUBMITTER_ITEMS,
  evaluator: EVALUATOR_ITEMS,
  judge: JUDGE_ITEMS,
  admin: ADMIN_ITEMS,
  // aliases returned by innovation.v_user_roles.role_code
  innovator: SUBMITTER_ITEMS,
  committee: JUDGE_ITEMS,
  supervisor: SUPERVISOR_ITEMS,
};

/**
 * Returns the unified menu for a role:
 *   admin      → Admin Hub → admin items → Notifications → Settings
 *   evaluator  → My Dashboard → evaluator items → /evaluator/notifications → /evaluator/settings
 *   everyone   → My Dashboard → role items → Notifications → Settings
 * Logout is appended separately by the consuming component (it's a form action,
 * not a link).
 */
export function getMenuForRole(roleCode: string | null | undefined): MenuItem[] {
  const key = (roleCode ?? '').toLowerCase();
  const roleItems = ROLE_ITEMS[key] ?? SUBMITTER_ITEMS;
  const head =
    key === 'admin'
      ? ADMIN_HUB_ITEM
      : key === 'supervisor'
        ? SUPERVISOR_HUB_ITEM
        : DASHBOARD_ITEM;
  // Only evaluators get the themed /evaluator/{notifications,settings} tail;
  // supervisors use the standard platform notifications/settings pages.
  const tail = key === 'evaluator' ? EVALUATOR_TAIL : TAIL_ITEMS;
  return [head, ...roleItems, ...tail];
}

export { LogOut as LogoutIcon };
