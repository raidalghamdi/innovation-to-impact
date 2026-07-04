'use client';

import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  Legend,
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

export function AreaChart({
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
        <ReAreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? seriesColor(i);
              return (
                <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
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
          {series.map((s, i) => {
            const color = s.color ?? seriesColor(i);
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name ?? s.key}
                stroke={color}
                strokeWidth={1.75}
                fill={`url(#area-${s.key})`}
              />
            );
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
