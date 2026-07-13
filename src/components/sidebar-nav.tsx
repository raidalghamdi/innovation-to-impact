'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/roles';
import {
  LayoutDashboard,
  Target,
  Lightbulb,
  Calendar,
  ClipboardCheck,
  Users,
  FlaskConical,
  BarChart3,
  Trophy,
  Settings,
  Cog,
  GitBranch,
  FileText,
  Sparkles,
  Bell,
  Search,
  History,
  UserCog,
  Shapes,
  Database,
  FileDown,
  CalendarClock,
  ShieldCheck,
  Split,
  Upload,
  MailPlus,
  ClipboardList,
  SlidersHorizontal,
  Scale,
  ListChecks,
  Rocket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  href: string;
  key: string;
  icon: LucideIcon;
  stage?: string;
  roles?: Role[];
};

// If `roles` is omitted the item is visible to everyone.
const GROUPS: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'pipeline',
    items: [
      { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
      { href: '/tracks', key: 'tracks', icon: Target },
      { href: '/my-ideas', key: 'myIdeas', icon: Sparkles, roles: ['submitter', 'admin'] },
      { href: '/ideas', key: 'ideas', icon: Lightbulb, stage: '1–3' },
      { href: '/team', key: 'team', icon: GitBranch, roles: ['submitter', 'admin'] },
      { href: '/search', key: 'search', icon: Search },
      { href: '/activities', key: 'activities', icon: Calendar, stage: '2' },
      { href: '/evaluator', key: 'evaluation', icon: ClipboardCheck, stage: '4', roles: ['evaluator', 'admin'] },
      { href: '/committee', key: 'committee', icon: Users, stage: '4', roles: ['judge', 'admin'] },
      { href: '/pilots', key: 'pilots', icon: FlaskConical, stage: '6' },
      { href: '/profile/level', key: 'leaderboard', icon: Trophy },
    ],
  },
  {
    labelKey: 'governance',
    items: [
      { href: '/notifications', key: 'notifications', icon: Bell },
      { href: '/ip-terms', key: 'ipTerms', icon: FileText },
      { href: '/admin/analytics', key: 'adminAnalytics', icon: BarChart3, roles: ['admin'] },
      { href: '/admin/all-ideas', key: 'allIdeas', icon: Lightbulb, roles: ['admin'] },
      { href: '/admin', key: 'admin', icon: Cog, roles: ['admin'] },
      { href: '/admin/users', key: 'usersManagement', icon: UserCog, roles: ['admin'] },
      { href: '/admin/roles', key: 'rolesCatalog', icon: Shapes, roles: ['admin'] },
      { href: '/admin/audit', key: 'audit', icon: History, roles: ['admin'] },
      { href: '/admin/backup', key: 'backup', icon: Database, roles: ['admin'] },
      { href: '/admin/settings', key: 'adminSettings', icon: SlidersHorizontal, roles: ['admin'] },
      { href: '/admin/committee-criteria', key: 'committeeCriteria', icon: Scale, roles: ['admin'] },
      { href: '/admin/evaluator-assignments', key: 'evalAssignments', icon: ListChecks, roles: ['admin'] },
      { href: '/admin/final-ranking', key: 'finalRanking', icon: Trophy, roles: ['admin'] },
      { href: '/admin/post-program', key: 'postProgram', icon: Rocket, roles: ['admin'] },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
  {
    // Supervisor parity — same organization-wide tools as admin, surfaced under
    // /supervisor/* so supervisors get their own navigation into these features.
    labelKey: 'supervisorTools',
    items: [
      { href: '/admin/all-ideas', key: 'allIdeas', icon: Lightbulb, roles: ['supervisor'] },
      { href: '/supervisor/reports', key: 'supReports', icon: FileDown, roles: ['supervisor'] },
      { href: '/supervisor/analytics', key: 'supAnalytics', icon: BarChart3, roles: ['supervisor'] },
      { href: '/supervisor/phases', key: 'supPhases', icon: CalendarClock, roles: ['supervisor'] },
      { href: '/supervisor/escalations', key: 'supEscalations', icon: ShieldCheck, roles: ['supervisor'] },
      { href: '/supervisor/cms', key: 'supCms', icon: FileText, roles: ['supervisor'] },
      { href: '/supervisor/assignments', key: 'supAssignments', icon: Split, roles: ['supervisor'] },
      { href: '/supervisor/employees/import', key: 'supEmployeesImport', icon: Upload, roles: ['supervisor'] },
      { href: '/supervisor/invitation-templates', key: 'supInvitationTemplates', icon: MailPlus, roles: ['supervisor'] },
      { href: '/supervisor/roster', key: 'supRoster', icon: ClipboardList, roles: ['supervisor'] },
      { href: '/admin/evaluator-assignments', key: 'evalAssignments', icon: ListChecks, roles: ['supervisor'] },
      { href: '/admin/committee-criteria', key: 'committeeCriteria', icon: Scale, roles: ['supervisor'] },
    ],
  },
];

export function SidebarNav({
  onNavigate,
  role = 'submitter',
}: {
  onNavigate?: () => void;
  role?: Role;
}) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tStage = tCommon('stage');
  const tStageShort = tCommon('stageShort');
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label={t('pipeline')}>
      {GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.roles || item.roles.includes(role)
        );
        if (items.length === 0) return null;
        return (
          <div key={group.labelKey}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={item.stage ? `${t(item.key)} — ${tStage} ${item.stage}` : t(item.key)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
                        active
                          ? 'bg-brand-teal text-white'
                          : 'text-foreground hover:bg-brand-teal-light'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{t(item.key)}</span>
                      {item.stage && (
                        // Stage pill: single element that starts with a real,
                        // visible "S" (localized short form of "Stage") plus a
                        // hair-space before the number. Because it's one span
                        // containing text of the form "S 0" or "S 1–3", any
                        // text-extraction pipeline sees the label separated
                        // from the stage marker — no more "Strategy0".
                        //
                        // An sr-only prefix expands "S" to the full localized
                        // "Stage" word for screen readers, so the accessible
                        // reading remains "Strategy — Stage 0".
                        <span
                          className={cn(
                            'ms-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none tabular-nums',
                            active
                              ? 'bg-white/25 text-white ring-1 ring-white/40'
                              : 'bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal/20'
                          )}
                        >
                          <span className="sr-only">{`— ${tStage} `}</span>
                          <span aria-hidden="true" className="opacity-60">{tStageShort}</span>
                          <span aria-hidden="true">{item.stage}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
