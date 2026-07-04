'use client';

import { Line, LineChart as ReLineChart, ResponsiveContainer } from 'recharts';
import { seriesColor } from './theme';

// Minimal trend line — no axes, grid, or tooltip. Feeds off a plain number[]
// (last 7-30 points). Used inside KpiCard.
export function Sparkline({
  values,
  color,
  height = 32,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (!values.length) return null;
  const data = values.map((value, i) => ({ i, value }));
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color ?? seriesColor(0)}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}
