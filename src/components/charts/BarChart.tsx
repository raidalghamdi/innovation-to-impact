'use client';

import {
  Bar,
  BarChart as ReBarChart,
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

type Props = ChartProps & {
  // Fired when a bar is clicked, with the underlying data row. Used by the
  // pillar chart to drill into a theme.
  onSelect?: (row: Record<string, unknown>) => void;
};

export function BarChart({
  data,
  xKey,
  series,
  title,
  height = 260,
  className,
  onSelect,
}: Props) {
  const { locale, isRtl } = useChartLocale();
  const fmt = (v: number) => formatChartNumber(locale, v);

  return (
    <ChartFrame title={title} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
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
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={s.color ?? seriesColor(i)}
              radius={[3, 3, 0, 0]}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={onSelect ? (entry: { payload?: Record<string, unknown> }) => entry.payload && onSelect(entry.payload) : undefined}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
