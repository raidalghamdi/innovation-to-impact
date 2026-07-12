'use client';

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from './ChartFrame';
import { formatChartNumber, seriesColor, useChartLocale } from './theme';

type HBarDatum = { label: string; count: number };

// Horizontal bar chart: categories run down the trailing axis, values along the
// baseline. Used where category labels are long (strategic themes, innovator
// names) and would collide on a vertical x-axis.
export function HBarChart({
  data,
  title,
  height = 280,
  className,
}: {
  data: HBarDatum[];
  title?: string;
  height?: number;
  className?: string;
}) {
  const { locale, isRtl } = useChartLocale();
  const fmt = (v: number) => formatChartNumber(locale, v);

  return (
    <ChartFrame title={title} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            orientation={isRtl ? 'top' : 'bottom'}
            reversed={isRtl}
            tickFormatter={fmt}
            tick={{ className: 'fill-muted-foreground tabular-nums', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            orientation={isRtl ? 'right' : 'left'}
            width={130}
            tick={{ className: 'fill-muted-foreground', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            position={isRtl ? { x: 0, y: 0 } : undefined}
            wrapperClassName="!rounded-md !border !border-border !bg-background text-xs tabular-nums"
            cursor={{ className: 'fill-muted', opacity: 0.3 }}
          />
          <Bar dataKey="count" radius={isRtl ? [3, 0, 0, 3] : [0, 3, 3, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
