// Role-aware quick actions map — adopted from the GAC hackathon prototype
// (gac-hackathon-v2-3 · const QA{}) and re-mapped to i2i routes.
//
// Consumer pattern: read a role, get an ordered list of at-most-5 action
// tiles for the personalized dashboard. Anything on the shared home stays
// role-independent; personalization lives here.

import type { Role } from '@/lib/roles';

export type QuickAction = {
  id: string;
  icon: string; // emoji (matches the prototype's iconography)
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  href: string; // in-app route (locale prefix added by <Link> from @/i18n/routing)
};

// Partial: aliased roles (supervisor/committee/innovator) fall back to the
// closest base role via getQuickActions() below, so they need no own entry.
export const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  submitter: [
    {
      id: 'submit-idea',
      icon: '💡',
      labelEn: 'Submit a new idea',
      labelAr: 'قدّم فكرة جديدة',
      subEn: 'Start from a note',
      subAr: 'ابدأ من ملاحظة',
      href: '/ideas/new',
    },
    {
      id: 'my-ideas',
      icon: '🗂',
      labelEn: 'My ideas',
      labelAr: 'أفكاري',
      subEn: 'Track their status',
      subAr: 'تابع حالة أفكارك',
      href: '/my-ideas',
    },
    {
      id: 'criteria',
      icon: '📐',
      labelEn: 'Evaluation criteria',
      labelAr: 'معايير التقييم',
      subEn: 'How ideas are scored',
      subAr: 'اعرف كيف تُقيَّم',
      href: '/evaluation-criteria',
    },
    {
      id: 'roadmap',
      icon: '🗓',
      labelEn: 'Roadmap',
      labelAr: 'الجدول الزمني',
      subEn: 'Journey milestones',
      subAr: 'محطات الرحلة',
      href: '/roadmap',
    },
    {
      id: 'support',
      icon: '🎧',
      labelEn: 'Support',
      labelAr: 'الدعم',
      subEn: 'The innovation team is with you',
      subAr: 'فريق الابتكار معك',
      href: '/support',
    },
  ],
  evaluator: [
    {
      id: 'evaluation-queue',
      icon: '📋',
      labelEn: 'Evaluation queue',
      labelAr: 'قائمة التقييم',
      subEn: 'Ideas awaiting your review',
      subAr: 'أفكار بانتظار مراجعتك',
      href: '/evaluator',
    },
    {
      id: 'criteria',
      icon: '📐',
      labelEn: 'Evaluation criteria',
      labelAr: 'معايير التقييم',
      subEn: 'Approved weights',
      subAr: 'الأوزان المعتمدة',
      href: '/evaluation-criteria',
    },
    {
      id: 'submit-idea',
      icon: '💡',
      labelEn: 'Submit an idea',
      labelAr: 'قدّم فكرة',
      subEn: 'You can participate too',
      subAr: 'شارك كمنسوب أيضًا',
      href: '/ideas/new',
    },
    {
      id: 'roadmap',
      icon: '🗓',
      labelEn: 'Roadmap',
      labelAr: 'الجدول الزمني',
      subEn: 'Evaluation windows',
      subAr: 'مواعيد التقييم',
      href: '/roadmap',
    },
    {
      id: 'support',
      icon: '🎧',
      labelEn: 'Support',
      labelAr: 'الدعم',
      subEn: 'The innovation team is with you',
      subAr: 'فريق الابتكار معك',
      href: '/support',
    },
  ],
  judge: [
    {
      id: 'committee',
      icon: '⚖️',
      labelEn: 'Committee work',
      labelAr: 'أعمال اللجنة',
      subEn: 'Shortlist and schedule',
      subAr: 'المتأهلون والجدول',
      href: '/committee',
    },
    {
      id: 'criteria',
      icon: '📐',
      labelEn: 'Endorsement criteria',
      labelAr: 'معايير الاعتماد',
      subEn: 'Approved weights',
      subAr: 'الأوزان المعتمدة',
      href: '/evaluation-criteria',
    },
    {
      id: 'roadmap',
      icon: '🗓',
      labelEn: 'Roadmap',
      labelAr: 'الجدول الزمني',
      subEn: 'Judging day',
      subAr: 'يوم التحكيم',
      href: '/roadmap',
    },
    {
      id: 'analytics',
      icon: '📊',
      labelEn: 'Analytics',
      labelAr: 'أرقام المنصة',
      subEn: 'Executive overview',
      subAr: 'نظرة عامة',
      href: '/analytics',
    },
    {
      id: 'support',
      icon: '🎧',
      labelEn: 'Support',
      labelAr: 'الدعم',
      subEn: 'The innovation team is with you',
      subAr: 'فريق الابتكار معك',
      href: '/support',
    },
  ],
  admin: [
    {
      id: 'admin-console',
      icon: '🛠',
      labelEn: 'Admin console',
      labelAr: 'لوحة الإدارة',
      subEn: 'Manage the platform',
      subAr: 'إدارة المنصة',
      href: '/admin',
    },
    {
      id: 'cms',
      icon: '🧩',
      labelEn: 'Manage widgets',
      labelAr: 'إدارة الودجات',
      subEn: 'Show or hide sections',
      subAr: 'أظهر وأخفِ الأقسام',
      href: '/admin/cms',
    },
    {
      id: 'submit-idea',
      icon: '💡',
      labelEn: 'Submit an idea',
      labelAr: 'قدّم فكرة',
      subEn: 'You can participate too',
      subAr: 'شارك كمنسوب أيضًا',
      href: '/ideas/new',
    },
    {
      id: 'roadmap',
      icon: '🗓',
      labelEn: 'Roadmap',
      labelAr: 'الجدول الزمني',
      subEn: 'Journey milestones',
      subAr: 'محطات الرحلة',
      href: '/roadmap',
    },
    {
      id: 'support',
      icon: '🎧',
      labelEn: 'Support',
      labelAr: 'الدعم',
      subEn: 'The innovation team is with you',
      subAr: 'فريق الابتكار معك',
      href: '/support',
    },
  ],
};

// Alias the first-class-but-derived roles onto their base action set:
// committee → judge, supervisor → evaluator, innovator → submitter.
const QUICK_ACTION_ALIAS: Partial<Record<Role, Role>> = {
  committee: 'judge',
  supervisor: 'evaluator',
  innovator: 'submitter',
};

export function getQuickActions(role: Role): QuickAction[] {
  const resolved = QUICK_ACTIONS[role] ?? QUICK_ACTIONS[QUICK_ACTION_ALIAS[role] ?? 'submitter'];
  return resolved ?? QUICK_ACTIONS.submitter!;
}

// Widget registry — parallel to the prototype's WIDGETS[]. Each widget id
// corresponds to a `cms_blocks` row with page='dashboard' and kind='section'.
// isSectionEnabled(cms, id) drives visibility; absent row => enabled.
export const DASHBOARD_WIDGETS = [
  { id: 'quick_actions', labelEn: 'Quick actions', labelAr: 'الإجراءات السريعة' },
  { id: 'announcements', labelEn: 'Latest announcements', labelAr: 'آخر الإعلانات' },
  { id: 'events', labelEn: 'Events & workshops', labelAr: 'الفعاليات والورش' },
  { id: 'my_recent_ideas', labelEn: 'My recent ideas', labelAr: 'أفكاري الأخيرة' },
  { id: 'gamification', labelEn: 'Points & badges', labelAr: 'النقاط والشارات' },
  { id: 'platform_activity', labelEn: 'Platform activity', labelAr: 'نشاط المنصة' },
  { id: 'journey_status', labelEn: 'Journey status', labelAr: 'نظرة على الرحلة' },
  { id: 'timeline', labelEn: 'Roadmap timeline', labelAr: 'الجدول الزمني' },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id'];
