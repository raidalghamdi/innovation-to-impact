'use client';

import {
  Area,
  AreaChart,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
} from 'recharts';
import { useId } from 'react';
import { seriesColor } from './theme';

// Minimal trend line — no axes, grid, or tooltip. Feeds off a plain number[]
// (last 7-30 points). Used inside KpiCard.
//
// `variant`:
//   'line' (default) — thin trend line, unchanged legacy look.
//   'area' — smooth 2px stroke with a top→bottom gradient fill (25%→0%) and a
//   single filled dot on the final point. Used by the Total Ideas KPI card.
export function Sparkline({
  values,
  color,
  height = 32,
  className,
  variant = 'line',
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  variant?: 'line' | 'area';
}) {
  const gradientId = useId();
  if (!values.length) return null;
  const data = values.map((value, i) => ({ i, value }));
  const stroke = color ?? seriesColor(0);
  const lastIndex = data.length - 1;

  if (variant === 'area') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (index !== lastIndex || cx == null || cy == null) {
                  return <g key={`dot-${index}`} />;
                }
                return (
                  <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={stroke} stroke="none" />
                );
              }}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}
