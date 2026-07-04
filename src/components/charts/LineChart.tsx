'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from './ChartFrame';
import {
  formatChartNumber,
  seriesColor,
  useChartLocale,
  type ChartProps,
} from './theme';

export function LineChart({
  data,
  xKey,
  series,
  title,
  height = 260,
  className,
}: ChartProps) {
  const { locale, isRtl } = useChartLocale();
  const fmt = (v: number) => formatChartNumber(locale, v);

  return (
    <ChartFrame title={title} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            reversed={isRtl}
            tick={{ className: 'fill-muted-foreground tabular-nums', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            orientation={isRtl ? 'right' : 'left'}
            tickFormatter={fmt}
            tick={{ className: 'fill-muted-foreground tabular-nums', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            position={isRtl ? { x: 0, y: 0 } : undefined}
            wrapperClassName="!rounded-md !border !border-border !bg-background text-xs tabular-nums"
          />
          {series.length > 1 && <Legend align={isRtl ? 'right' : 'left'} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={s.color ?? seriesColor(i)}
              strokeWidth={1.75}
              dot={false}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
