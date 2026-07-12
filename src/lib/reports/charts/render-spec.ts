// Bridge: turn a screen-spec chart + its live ChartDatum into a rendered PNG.
// Keeps the datum→ChartData mapping in one place so the PDF and PPTX assemblers
// stay identical in what they draw.
import { renderChart, type ChartData, type ChartType } from './renderChart';
import type { ChartDatum } from '../data/live-queries';
import type { ChartSpec } from '../screen-specs';
import { isHorizontal } from '../screen-specs';

function datumToChartData(datum: ChartDatum): ChartData {
  switch (datum.kind) {
    case 'categorical':
      return { labels: datum.labels, series: [{ values: datum.values }] };
    case 'multi':
      return { labels: datum.labels, series: datum.series };
    case 'points':
      return { points: datum.points };
    case 'matrix':
      return { matrix: datum.matrix, xLabels: datum.xLabels, yLabels: datum.yLabels };
    case 'values':
      return { values: datum.values };
    default:
      return {};
  }
}

// Render a single chart to a PNG buffer at the requested pixel size.
export function renderSpecChart(
  spec: ChartSpec,
  datum: ChartDatum | undefined,
  size: { width: number; height: number }
): Buffer {
  const data = datum ? datumToChartData(datum) : {};
  return renderChart({
    type: spec.type as ChartType,
    data,
    options: {
      width: size.width,
      height: size.height,
      horizontal: spec.type === 'bar' && isHorizontal(spec.id),
      valueLabels: spec.type === 'bar',
      legend: spec.type === 'donut',
    },
  });
}
