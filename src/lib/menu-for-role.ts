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

const TAIL_ITEMS: MenuItem[] = [
  { href: '/notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Bell },
  { href: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: SettingsIcon },
];

const ROLE_ITEMS: Record<string, MenuItem[]> = {
  innovator: [
    { href: '/my-ideas', labelAr: 'أفكاري', labelEn: 'My Ideas', icon: Lightbulb },
    { href: '/ideas/new', labelAr: 'قدّم فكرة', labelEn: 'Submit Idea', icon: PlusCircle },
    { href: '/team', labelAr: 'فريقي', labelEn: 'My Team', icon: Users2 },
    { href: '/profile/level', labelAr: 'مستواي', labelEn: 'My Level', icon: Star },
  ],
  judge: [
    { href: '/evaluation', labelAr: 'قائمة التقييم', labelEn: 'Evaluation Queue', icon: ClipboardList },
    { href: '/evaluation?filter=completed', labelAr: 'التقييمات المكتملة', labelEn: 'Completed Evaluations', icon: CheckCircle2 },
  ],
  committee: [
    { href: '/committee', labelAr: 'القرارات المعلّقة', labelEn: 'Pending Decisions', icon: Gavel },
    { href: '/committee?filter=history', labelAr: 'سجل القرارات', labelEn: 'Decision History', icon: History },
  ],
  admin: [
    { href: '/admin/users', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: UserCog },
    { href: '/admin/roles', labelAr: 'كتالوج الأدوار', labelEn: 'Roles Catalog', icon: Shapes },
    { href: '/admin/employees/import', labelAr: 'استيراد الموظفين', labelEn: 'Employees Import', icon: Upload },
    { href: '/admin/settings', labelAr: 'إعدادات المنصة', labelEn: 'Platform Settings', icon: SlidersHorizontal },
    { href: '/admin/audit', labelAr: 'سجلات التدقيق', labelEn: 'Audit Logs', icon: FileBarChart },
  ],
  supervisor: [
    { href: '/team', labelAr: 'نظرة عامة على الفريق', labelEn: 'Team Overview', icon: Users2 },
    { href: '/admin/escalations', labelAr: 'التصعيدات', labelEn: 'Escalations', icon: ShieldCheck },
    { href: '/analytics', labelAr: 'تقارير القطاع', labelEn: 'Sector Reports', icon: FileBarChart },
  ],
};

/**
 * Returns the unified menu for a role: My Dashboard → role items → Notifications → Settings.
 * Logout is appended separately by the consuming component (it's a form action,
 * not a link).
 */
export function getMenuForRole(roleCode: string | null | undefined): MenuItem[] {
  const roleItems = (roleCode && ROLE_ITEMS[roleCode]) || [];
  return [DASHBOARD_ITEM, ...roleItems, ...TAIL_ITEMS];
}

export { LogOut as LogoutIcon };
