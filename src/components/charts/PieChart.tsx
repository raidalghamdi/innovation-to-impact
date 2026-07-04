'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartFrame } from './ChartFrame';
import {
  formatChartNumber,
  seriesColor,
  useChartLocale,
  type ChartProps,
} from './theme';

// For a pie, the first series entry names the value key; `xKey` names the label
// key. Each datum becomes one slice, coloured from the sequence.
export function PieChart({
  data,
  xKey,
  series,
  title,
  height = 260,
  className,
}: ChartProps) {
  const { locale, isRtl } = useChartLocale();
  const fmt = (v: number) => formatChartNumber(locale, v);
  const valueKey = series[0]?.key ?? 'value';

  return (
    <ChartFrame title={title} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RePieChart>
          <Pie data={data} dataKey={valueKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="80%">
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            position={isRtl ? { x: 0, y: 0 } : undefined}
            wrapperClassName="!rounded-md !border !border-border !bg-background text-xs tabular-nums"
          />
          <Legend align={isRtl ? 'right' : 'left'} />
        </RePieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
