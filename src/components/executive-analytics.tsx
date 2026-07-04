// SSR-safe SVG charts for the executive analytics dashboard. Matches the
// styling of the existing CohortChart on the same page (design-foundations
// chart palette; teal primary at #20808D).
import type {
  AvgTimePerStageRow,
  IdeasByStageRow,
  SubmissionsPerDayRow,
  TopObjectiveRow,
} from '@/lib/analytics';
import { pickFromRow } from '@/lib/i18n-content';

const TEAL = '#20808D';
const TEAL_DARK = '#1B474D';
const GOLD = '#FFC553';
const MUTED = 'currentColor';

// -----------------------------------------------------------------------
// 1. Ideas by stage — vertical bar chart
// -----------------------------------------------------------------------
export function IdeasByStageChart({
  rows,
  stageLabels,
  empty,
}: {
  rows: IdeasByStageRow[];
  stageLabels: string[];
  empty: string;
}) {
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const max = Math.max(...rows.map((r) => r.count), 1);
  const W = Math.max(rows.length * 56, 320);
  const H = 220;
  const pad = { top: 12, bottom: 44, left: 32, right: 8 };
  const chartH = H - pad.top - pad.bottom;
  const groupW = (W - pad.left - pad.right) / rows.length;
  const barW = Math.min(28, groupW - 10);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" className="min-w-full">
        {/* baseline */}
        <line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={W - pad.right}
          y2={pad.top + chartH}
          stroke={MUTED}
          className="text-border"
        />
        {rows.map((r, i) => {
          const h = (r.count / max) * chartH;
          const x = pad.left + i * groupW + (groupW - barW) / 2;
          const y = pad.top + chartH - h;
          return (
            <g key={r.stage}>
              <rect x={x} y={y} width={barW} height={h} fill={TEAL} rx={3}>
                <title>{`${stageLabels[i]}: ${r.count}`}</title>
              </rect>
              {r.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-brand-teal text-[10px] font-medium"
                >
                  {r.count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 24}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {i}
              </text>
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {stageLabels[i]?.slice(0, 10) ?? ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------
// 2. Submissions per day (last 90 days) — line chart with area fill
// -----------------------------------------------------------------------
export function SubmissionsLineChart({
  rows,
  empty,
  locale,
}: {
  rows: SubmissionsPerDayRow[];
  empty: string;
  locale: string;
}) {
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const max = Math.max(...rows.map((r) => r.count), 1);
  const W = 760;
  const H = 220;
  const pad = { top: 14, bottom: 32, left: 32, right: 12 };
  const chartH = H - pad.top - pad.bottom;
  const chartW = W - pad.left - pad.right;
  const stepX = rows.length > 1 ? chartW / (rows.length - 1) : chartW;

  const points = rows.map((r, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + chartH - (r.count / max) * chartH,
    row: r,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    `M ${points[0].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} ` +
    points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`;

  // Show ~6 x-axis labels evenly spaced
  const nLabels = 6;
  const labelStep = Math.max(1, Math.floor(rows.length / nLabels));
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Horizontal gridlines at 0, 25%, 50%, 75%, 100% of max
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" className="min-w-full">
        <defs>
          <linearGradient id="ideas-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity="0.28" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridTicks.map((t, i) => {
          const y = pad.top + chartH - t * chartH;
          const val = Math.round(t * max);
          return (
            <g key={i}>
              <line
                x1={pad.left}
                y1={y}
                x2={W - pad.right}
                y2={y}
                stroke={MUTED}
                className="text-border"
                strokeDasharray={i === 0 ? '' : '3 3'}
                opacity={i === 0 ? 1 : 0.5}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px]"
              >
                {val}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#ideas-line-fill)" />
        <path d={linePath} fill="none" stroke={TEAL} strokeWidth={1.75} />
        {points.map((p, i) =>
          p.row.count > 0 ? (
            <circle key={i} cx={p.x} cy={p.y} r={2} fill={TEAL}>
              <title>{`${p.row.day}: ${p.row.count}`}</title>
            </circle>
          ) : null,
        )}
        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          const date = new Date(p.row.day + 'T00:00:00Z');
          return (
            <text
              key={`lbl-${i}`}
              x={p.x}
              y={H - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {dateFmt.format(date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------
// 3. Top objectives — horizontal bar chart
// -----------------------------------------------------------------------
export function TopObjectivesChart({
  rows,
  empty,
  locale,
}: {
  rows: TopObjectiveRow[];
  empty: string;
  locale: string;
}) {
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const max = Math.max(...rows.map((r) => r.count), 1);
  const isAr = locale === 'ar';
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const name =
          pickFromRow(r, 'name', locale) || '—';
        return (
          <div key={r.theme_id} className="flex items-center gap-3">
            <span
              className="w-40 shrink-0 truncate text-xs text-muted-foreground"
              title={name}
              dir={isAr ? 'rtl' : 'ltr'}
            >
              {name}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className="flex h-full items-center justify-end rounded-md bg-brand-teal px-2 text-[11px] font-medium text-white"
                style={{ width: `${Math.max((r.count / max) * 100, 6)}%` }}
              >
                {r.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------
// 4. Avg time in each stage — table with mini bars
// -----------------------------------------------------------------------
export function AvgTimePerStageTable({
  rows,
  stageLabels,
  headers,
  empty,
}: {
  rows: AvgTimePerStageRow[];
  stageLabels: string[];
  headers: { stage: string; avg: string };
  empty: string;
}) {
  const nonZero = rows.filter((r) => r.stage > 0);
  const total = nonZero.reduce((acc, r) => acc + r.avg_days, 0);
  if (total === 0) return <p className="p-6 text-sm text-muted-foreground">{empty}</p>;

  const max = Math.max(...nonZero.map((r) => r.avg_days), 1);
  return (
    <table className="w-full text-sm">
      <thead className="bg-brand-teal-light/50">
        <tr>
          <th className="p-3 text-start font-semibold text-brand-teal">{headers.stage}</th>
          <th className="p-3 text-end font-semibold text-brand-teal">{headers.avg}</th>
        </tr>
      </thead>
      <tbody>
        {nonZero.map((r) => (
          <tr key={r.stage} className="border-t border-border">
            <td className="p-3 text-foreground">
              <span className="me-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal-light text-[10px] font-semibold text-brand-teal">
                {r.stage}
              </span>
              {stageLabels[r.stage] ?? `#${r.stage}`}
            </td>
            <td className="p-3">
              <div className="flex items-center justify-end gap-3">
                <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-muted sm:block">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((r.avg_days / max) * 100, 4)}%`,
                      backgroundColor: TEAL_DARK,
                    }}
                  />
                </div>
                <span className="w-16 text-end font-medium text-brand-teal">
                  {r.avg_days.toFixed(1)}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// -----------------------------------------------------------------------
// 5. Conversion big-number card (submitted → pilot)
// -----------------------------------------------------------------------
export function ConversionStatCard({
  submitted,
  pilot,
  rate,
  labels,
}: {
  submitted: number;
  pilot: number;
  rate: number;
  labels: { submitted: string; pilot: string; rate: string };
}) {
  const clamped = Math.min(Math.max(rate, 0), 100);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-brand-teal tabular-nums">
          {rate.toFixed(1)}
        </span>
        <span className="text-lg font-medium text-brand-teal-dark">%</span>
        <span className="ms-2 text-xs text-muted-foreground">{labels.rate}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${TEAL} 0%, ${GOLD} 100%)`,
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{labels.submitted}</p>
          <p className="text-xl font-bold text-brand-teal">{submitted}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{labels.pilot}</p>
          <p className="text-xl font-bold text-brand-teal">{pilot}</p>
        </div>
      </div>
    </div>
  );
}
