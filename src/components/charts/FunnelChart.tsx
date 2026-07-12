'use client';

import {
  Cell,
  Funnel,
  FunnelChart as ReFunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartFrame } from './ChartFrame';
import { formatChartNumber, seriesColor, useChartLocale } from './theme';

type FunnelDatum = { label: string; count: number };

// Vertical conversion funnel. Each datum is one stage; width shrinks with the
// count. Labels sit to the trailing side so the widest (top) bar reads first in
// both LTR and RTL.
export function FunnelChart({
  data,
  title,
  height = 260,
  className,
}: {
  data: FunnelDatum[];
  title?: string;
  height?: number;
  className?: string;
}) {
  const { locale, isRtl } = useChartLocale();
  const fmt = (v: number) => formatChartNumber(locale, v);

  return (
    <ChartFrame title={title} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ReFunnelChart>
          <Tooltip
            formatter={(v) => fmt(Number(v))}
            position={isRtl ? { x: 0, y: 0 } : undefined}
            wrapperClassName="!rounded-md !border !border-border !bg-background text-xs tabular-nums"
          />
          <Funnel dataKey="count" data={data} isAnimationActive={false} lastShapeType="rectangle">
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
            <LabelList
              position={isRtl ? 'left' : 'right'}
              dataKey="label"
              className="fill-foreground"
              stroke="none"
              fontSize={11}
            />
            <LabelList
              position="center"
              dataKey="count"
              className="fill-white tabular-nums"
              stroke="none"
              fontSize={12}
              formatter={(v: React.ReactNode) => fmt(Number(v))}
            />
          </Funnel>
        </ReFunnelChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
