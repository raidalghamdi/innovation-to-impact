'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { KPICard } from '@/components/kpi-card';
import { Lightbulb, GitBranch, FlaskConical, TrendingUp } from 'lucide-react';
import { formatSAR, formatNumber, cn } from '@/lib/utils';

type Stats = {
  total: number;
  inPipeline: number;
  inPilot: number;
  realizedBenefits: number;
};

const FACTORS: Record<string, number> = {
  all: 1,
  year: 0.78,
  quarter: 0.32,
  month: 0.14,
};

export function StatsBlock({ stats, locale }: { stats: Stats; locale: string }) {
  const t = useTranslations('landing');
  const [range, setRange] = useState<keyof typeof FACTORS>('all');

  const scaled = useMemo(() => {
    const f = FACTORS[range];
    return {
      total: Math.round(stats.total * f),
      inPipeline: Math.round(stats.inPipeline * f),
      inPilot: Math.round(stats.inPilot * f),
      realizedBenefits: Math.round(stats.realizedBenefits * f),
    };
  }, [stats, range]);

  const ranges: { key: keyof typeof FACTORS; label: string }[] = [
    { key: 'all', label: t('timeframeAll') },
    { key: 'month', label: t('timeframeMonth') },
    { key: 'quarter', label: t('timeframeQuarter') },
    { key: 'year', label: t('timeframeYear') },
  ];

  return (
    <div>
      {/* Timeframe toggle */}
      <div className="mt-4 inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1">
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition',
              range === r.key
                ? 'bg-brand-teal text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label={t('statIdeas')} value={formatNumber(scaled.total)} icon={Lightbulb} />
        <KPICard label={t('statPipeline')} value={formatNumber(scaled.inPipeline)} icon={GitBranch} />
        <KPICard label={t('statPilots')} value={formatNumber(scaled.inPilot)} icon={FlaskConical} />
        <KPICard
          label={t('statBenefits')}
          value={formatSAR(scaled.realizedBenefits, locale)}
          icon={TrendingUp}
          accent="gold"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t('lastUpdated')}: {t('minutesAgo')}
      </p>
    </div>
  );
}
