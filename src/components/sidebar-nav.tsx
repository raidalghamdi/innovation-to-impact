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
  Rocket,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  ScrollText,
  BarChart3,
  Trophy,
  Settings,
  Cog,
  GitBranch,
  FileText,
  Sparkles,
  Bell,
  Search,
  Map,
  History,
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
      { href: '/stages', key: 'stages', icon: GitBranch },
      { href: '/strategy', key: 'strategy', icon: Target, stage: '0' },
      { href: '/my-ideas', key: 'myIdeas', icon: Sparkles, roles: ['submitter', 'admin'] },
      { href: '/ideas', key: 'ideas', icon: Lightbulb, stage: '1·3' },
      { href: '/search', key: 'search', icon: Search },
      { href: '/activities', key: 'activities', icon: Calendar, stage: '2' },
      { href: '/evaluation', key: 'evaluation', icon: ClipboardCheck, stage: '4', roles: ['evaluator', 'admin'] },
      { href: '/committee', key: 'committee', icon: Users, stage: '4', roles: ['judge', 'admin'] },
      { href: '/pilots', key: 'pilots', icon: FlaskConical, stage: '6' },
      { href: '/implementation', key: 'implementation', icon: Rocket, stage: '7' },
      { href: '/benefits', key: 'benefits', icon: TrendingUp, stage: '8' },
      { href: '/leaderboard', key: 'leaderboard', icon: Trophy },
    ],
  },
  {
    labelKey: 'governance',
    items: [
      { href: '/notifications', key: 'notifications', icon: Bell },
      { href: '/roadmap', key: 'roadmap', icon: Map },
      { href: '/ip', key: 'ip', icon: ShieldCheck },
      { href: '/ip-terms', key: 'ipTerms', icon: FileText },
      { href: '/knowledge', key: 'knowledge', icon: BookOpen },
      { href: '/compliance', key: 'compliance', icon: ScrollText },
      { href: '/analytics', key: 'analytics', icon: BarChart3, roles: ['admin'] },
      { href: '/admin/analytics', key: 'adminAnalytics', icon: BarChart3, roles: ['admin'] },
      { href: '/admin', key: 'admin', icon: Cog, roles: ['admin'] },
      { href: '/admin/audit', key: 'audit', icon: History, roles: ['admin'] },
      { href: '/settings', key: 'settings', icon: Settings },
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
  const tStage = useTranslations('common')('stage');
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
                        <span
                          aria-label={`${tStage} ${item.stage}`}
                          className={cn(
                            'ms-2 inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none tabular-nums',
                            active
                              ? 'bg-white/25 text-white ring-1 ring-white/40'
                              : 'bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal/20'
                          )}
                        >
                          {item.stage}
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
