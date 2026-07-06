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
  type LucideIcon,
} from 'lucide-react';

/**
 * src/lib/menu-for-role.ts:1
 * Phase 12.3 — single source of truth for the header avatar dropdown. Items
 * depend on the active role (innovation.roles.code), on top of a common base
 * shared by every role. hrefs are locale-relative (no /[locale] prefix — the
 * consuming component uses the routing-aware <Link>).
 */

export type MenuItem = {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
};

const BASE_ITEMS: MenuItem[] = [
  { href: '/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile', icon: User },
  { href: '/notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: Bell },
];

const ROLE_ITEMS: Record<string, MenuItem[]> = {
  innovator: [
    { href: '/my-ideas', labelAr: 'أفكاري', labelEn: 'My Ideas', icon: Lightbulb },
    { href: '/ideas/new', labelAr: 'قدّم فكرة جديدة', labelEn: 'Submit New Idea', icon: PlusCircle },
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

/** Returns the ordered menu items for a role code: base items first, then role-specific ones. Logout is appended separately by the consuming component (it's a form action, not a link). */
export function getMenuForRole(roleCode: string | null | undefined): MenuItem[] {
  const roleItems = (roleCode && ROLE_ITEMS[roleCode]) || [];
  return [...roleItems, ...BASE_ITEMS];
}

export { LogOut as LogoutIcon };
