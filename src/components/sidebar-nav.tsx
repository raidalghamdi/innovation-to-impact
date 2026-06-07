'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
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
  Wallet,
  ShieldCheck,
  BookOpen,
  ScrollText,
  BarChart3,
  Settings,
  Cog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = { href: string; key: string; icon: LucideIcon; stage?: string };

const GROUPS: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'pipeline',
    items: [
      { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
      { href: '/strategy', key: 'strategy', icon: Target, stage: '0' },
      { href: '/ideas', key: 'ideas', icon: Lightbulb, stage: '1·3' },
      { href: '/activities', key: 'activities', icon: Calendar, stage: '2' },
      { href: '/evaluation', key: 'evaluation', icon: ClipboardCheck, stage: '4' },
      { href: '/committee', key: 'committee', icon: Users, stage: '4' },
      { href: '/pilots', key: 'pilots', icon: FlaskConical, stage: '6' },
      { href: '/implementation', key: 'implementation', icon: Rocket, stage: '7' },
      { href: '/benefits', key: 'benefits', icon: TrendingUp, stage: '8' },
    ],
  },
  {
    labelKey: 'governance',
    items: [
      { href: '/funding', key: 'funding', icon: Wallet },
      { href: '/ip', key: 'ip', icon: ShieldCheck },
      { href: '/knowledge', key: 'knowledge', icon: BookOpen },
      { href: '/compliance', key: 'compliance', icon: ScrollText },
      { href: '/analytics', key: 'analytics', icon: BarChart3 },
      { href: '/admin', key: 'admin', icon: Cog },
      { href: '/settings', key: 'settings', icon: Settings },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {GROUPS.map((group) => (
        <div key={group.labelKey}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(group.labelKey)}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-brand-teal text-white'
                        : 'text-foreground hover:bg-brand-teal-light'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t(item.key)}</span>
                    {item.stage && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-muted text-muted-foreground'
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
      ))}
    </nav>
  );
}
