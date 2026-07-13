'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import { Sparkline } from '@/components/charts/Sparkline';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  KPI_DEFINITIONS,
  deltaPct,
  formatKpiValue,
  kpiLabel,
  type KpiFormat,
} from '@/lib/kpi-definitions';

type KPICardProps = {
  // Display / legacy contract (kept so existing callers render unchanged).
  label?: string;
  value?: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'teal' | 'gold';
  href?: string;
  hrefLabel?: string;
  locale?: string;
  // Registry-driven contract: format + label + delta come from kpi-definitions.
  kpiId?: string;
  current?: number;
  previous?: number;
  series?: number[];
  sparklineVariant?: 'line' | 'area';
  testId?: string;
};

function slug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Animate 0 → target over ~800ms (easeOutCubic) using rAF. Falls back to the
// final value immediately when the target isn't a finite number.
function useCountUp(target: number | null): number {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number>();
  useEffect(() => {
    if (target === null || !Number.isFinite(target)) return;
    const duration = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(target * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target]);
  return target === null ? 0 : display;
}

export function KPICard(props: KPICardProps) {
  const {
    hint,
    icon: Icon,
    accent = 'teal',
    href,
    hrefLabel,
    kpiId,
    current,
    previous,
    series,
    sparklineVariant = 'line',
    testId,
  } = props;

  const activeLocale = useLocale();
  const locale = props.locale ?? activeLocale;
  const def = kpiId ? KPI_DEFINITIONS[kpiId] : undefined;
  const format: KpiFormat | null = def?.format ?? null;

  const label = props.label ?? (kpiId ? kpiLabel(kpiId, locale) : '');

  // Numeric target for the count-up: prefer the registry `current`, else a
  // numeric legacy `value`. String values (e.g. "47%") render statically.
  const numericTarget =
    current !== undefined
      ? current
      : typeof props.value === 'number'
        ? props.value
        : null;
  const animated = useCountUp(numericTarget);

  const displayValue =
    numericTarget === null
      ? String(props.value ?? '')
      : format
        ? formatKpiValue(format, animated, locale)
        : formatKpiValue('int', animated, locale);

  // Delta chip: only when we have both periods.
  let delta: { text: string; tone: 'up' | 'down' | 'flat' } | null = null;
  if (current !== undefined && previous !== undefined) {
    const pct = deltaPct(current, previous);
    if (pct !== null) {
      const rounded = Math.round(pct * 10) / 10;
      const rising = rounded > 0.05;
      const falling = rounded < -0.05;
      const direction = def?.direction ?? 'up_good';
      // Map "is this movement good?" to colour: good → up (teal), bad → down (red).
      let tone: 'up' | 'down' | 'flat' = 'flat';
      if (rising) tone = direction === 'down_good' ? 'down' : direction === 'neutral' ? 'flat' : 'up';
      else if (falling) tone = direction === 'up_good' ? 'down' : direction === 'neutral' ? 'flat' : 'up';
      const arrow = rising ? '↑' : falling ? '↓' : '→';
      delta = { text: `${arrow} ${Math.abs(rounded)}%`, tone };
    }
  }

  const NavArrow = locale === 'ar' ? ArrowUpLeft : ArrowUpRight;
  const testAnchor = testId ?? label ?? kpiId ?? 'kpi';

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold text-foreground tabular-nums">{displayValue}</p>
            {delta && <DeltaChip text={delta.text} tone={delta.tone} />}
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
              accent === 'teal'
                ? 'bg-brand-teal-light text-brand-teal'
                : 'bg-brand-gold-light text-brand-gold'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {series && series.length > 1 && (
        <Sparkline
          values={series}
          variant={sparklineVariant}
          className="mt-3"
          color={accent === 'gold' ? '#FFC553' : '#20808D'}
        />
      )}
      {href && hrefLabel && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-teal">
          {hrefLabel}
          <NavArrow className="h-3 w-3" />
        </p>
      )}
    </>
  );

  const testProps = { 'data-testid': `kpi-card-${slug(testAnchor)}` };

  if (href) {
    return (
      <Link href={href} className="group block" {...testProps}>
        <Card className="p-5 transition-shadow hover:shadow-md hover:border-brand-teal/40">
          {inner}
        </Card>
      </Link>
    );
  }
  return (
    <Card className="p-5" {...testProps}>
      {inner}
    </Card>
  );
}

function DeltaChip({ text, tone }: { text: string; tone: 'up' | 'down' | 'flat' }) {
  const Icon = tone === 'up' ? ArrowUp : tone === 'down' ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        tone === 'up' && 'bg-brand-teal-light text-brand-teal',
        tone === 'down' && 'bg-red-100 text-red-600',
        tone === 'flat' && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {text.replace(/^[↑↓→]\s?/, '')}
    </span>
  );
}
