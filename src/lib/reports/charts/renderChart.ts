// Server-side chart renderer. Given { type, data, options } it returns a PNG
// Buffer that the PDF (pdf-lib embedPng) and PPTX (pptxgenjs addImage) layers
// drop straight in. Rendering is done with a dependency-free raster canvas (see
// ./canvas) so it runs anywhere Node runs — no cairo, no headless browser.
//
// Supported types (priority order): line, bar (v/h), stackedBar, donut (≤5
// slices + "Other"), area, sparkline, scatter, funnel (custom), heatmap
// (custom). Any unknown type renders a labelled placeholder tile of the correct
// dimensions rather than throwing, so a report is never blocked by one chart.
import { PngCanvas } from './canvas';
import { CHART_COLORS, CHART_SEQUENCE, colorAt, mix } from './theme';

export type ChartType =
  | 'line'
  | 'bar'
  | 'stackedBar'
  | 'area'
  | 'scatter'
  | 'donut'
  | 'funnel'
  | 'heatmap'
  | 'sparkline';

export type ChartSeries = { name?: string; color?: string; values: number[] };

export type ChartData = {
  labels?: string[];
  series?: ChartSeries[];
  points?: Array<{ x: number; y: number }>;
  matrix?: number[][];
  xLabels?: string[];
  yLabels?: string[];
  values?: number[];
};

export type ChartOptions = {
  width?: number;
  height?: number;
  horizontal?: boolean;
  maxSlices?: number;
  valueLabels?: boolean;
  bg?: string;
  legend?: boolean;
};

export type ChartInput = { type: ChartType; data: ChartData; options?: ChartOptions };

const DEFAULT_W = 720;
const DEFAULT_H = 420;

export function renderChart(input: ChartInput): Buffer {
  const { type, data } = input;
  const opts = input.options ?? {};
  const w = opts.width ?? DEFAULT_W;
  const h = opts.height ?? DEFAULT_H;
  const cv = new PngCanvas(w, h, opts.bg ?? CHART_COLORS.white);

  try {
    switch (type) {
      case 'line':
      case 'area':
        drawLine(cv, data, opts, type === 'area');
        break;
      case 'bar':
        opts.horizontal ? drawBarH(cv, data, opts) : drawBarV(cv, data, opts);
        break;
      case 'stackedBar':
        drawStackedBar(cv, data, opts);
        break;
      case 'donut':
        drawDonut(cv, data, opts);
        break;
      case 'scatter':
        drawScatter(cv, data, opts);
        break;
      case 'sparkline':
        drawSparkline(cv, data, opts);
        break;
      case 'funnel':
        drawFunnel(cv, data, opts);
        break;
      case 'heatmap':
        drawHeatmap(cv, data, opts);
        break;
      default:
        drawPlaceholder(cv, String(type));
    }
  } catch {
    drawPlaceholder(cv, type);
  }
  return cv.toPNG();
}

// ── Shared helpers ───────────────────────────────────────────────────────────
type Plot = { x: number; y: number; w: number; h: number };

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const frac = raw / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

// Draw axes + horizontal gridlines + y ticks + x category labels. Returns the
// value→pixel scale for the y axis.
function drawGrid(cv: PngCanvas, p: Plot, yMax: number, labels: string[], everyN = 1) {
  const ticks = 4;
  cv.hLine(p.x, p.x + p.w, p.y + p.h, CHART_COLORS.axis, 1.5); // x axis
  cv.vLine(p.x, p.y, p.y + p.h, CHART_COLORS.axis, 1.5); // y axis
  for (let t = 0; t <= ticks; t++) {
    const val = (yMax * t) / ticks;
    const yy = p.y + p.h - (p.h * t) / ticks;
    if (t > 0) cv.hLine(p.x, p.x + p.w, yy, CHART_COLORS.grid, 1);
    cv.text(p.x - 6, yy - PngCanvas.textHeight(2) / 2, fmtNum(val), CHART_COLORS.muted, 2, 'right');
  }
  const n = labels.length;
  if (n === 0) return;
  const step = p.w / n;
  for (let i = 0; i < n; i++) {
    if (i % everyN !== 0) continue;
    const cx = p.x + step * (i + 0.5);
    const label = shortLabel(labels[i]);
    cv.text(cx, p.y + p.h + 6, label, CHART_COLORS.muted, 2, 'center');
  }
}

function shortLabel(s: string): string {
  if (!s) return '';
  return s.length > 10 ? s.slice(0, 9) + '…' : s;
}

function seriesColor(s: ChartSeries, i: number): string {
  return s.color ?? colorAt(i);
}

function defaultPlot(cv: PngCanvas): Plot {
  return { x: 52, y: 18, w: cv.width - 52 - 18, h: cv.height - 18 - 40 };
}

// ── Line / Area ──────────────────────────────────────────────────────────────
function drawLine(cv: PngCanvas, data: ChartData, _o: ChartOptions, area: boolean) {
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  if (!series.length) return drawEmpty(cv);
  const p = defaultPlot(cv);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const everyN = labels.length > 12 ? Math.ceil(labels.length / 12) : 1;
  drawGrid(cv, p, max, labels, everyN);
  const n = Math.max(...series.map((s) => s.values.length));
  const step = n > 1 ? p.w / (n - 1) : 0;
  series.forEach((s, si) => {
    const col = seriesColor(s, si);
    const pts: Array<[number, number]> = s.values.map((v, i) => [
      p.x + step * i,
      p.y + p.h - (p.h * v) / max,
    ]);
    if (area && pts.length) {
      const poly: Array<[number, number]> = [
        [p.x, p.y + p.h],
        ...pts,
        [p.x + step * (pts.length - 1), p.y + p.h],
      ];
      cv.fillPolygon(poly, col, 0.18);
    }
    for (let i = 0; i + 1 < pts.length; i++)
      cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, 2.5);
    for (const [px, py] of pts) cv.fillCircle(px, py, 3, col);
  });
}

// ── Vertical bar ─────────────────────────────────────────────────────────────
function drawBarV(cv: PngCanvas, data: ChartData, o: ChartOptions) {
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  if (!series.length) return drawEmpty(cv);
  const p = defaultPlot(cv);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const everyN = labels.length > 14 ? Math.ceil(labels.length / 14) : 1;
  drawGrid(cv, p, max, labels, everyN);
  const groups = labels.length || series[0].values.length;
  const groupW = p.w / groups;
  const ns = series.length;
  const barW = (groupW * 0.7) / ns;
  for (let g = 0; g < groups; g++) {
    for (let s = 0; s < ns; s++) {
      const v = series[s].values[g] ?? 0;
      const bh = (p.h * v) / max;
      const bx = p.x + groupW * g + groupW * 0.15 + barW * s;
      const by = p.y + p.h - bh;
      cv.fillRect(bx, by, barW, bh, seriesColor(series[s], s));
      if (o.valueLabels && v > 0 && ns === 1)
        cv.text(bx + barW / 2, by - PngCanvas.textHeight(2) - 2, fmtNum(v), CHART_COLORS.shark, 2, 'center');
    }
  }
}

// ── Horizontal bar ───────────────────────────────────────────────────────────
function drawBarH(cv: PngCanvas, data: ChartData, o: ChartOptions) {
  const labels = data.labels ?? [];
  const values = (data.series?.[0]?.values ?? []).slice();
  if (!values.length) return drawEmpty(cv);
  const maxLabel = Math.max(...labels.map((l) => PngCanvas.textWidth(shortLabel(l), 2)), 0);
  const p: Plot = { x: 16 + maxLabel + 8, y: 14, w: cv.width - (16 + maxLabel + 8) - 40, h: cv.height - 14 - 20 };
  const max = niceMax(Math.max(1, ...values));
  // x gridlines
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const xx = p.x + (p.w * t) / ticks;
    cv.vLine(xx, p.y, p.y + p.h, t === 0 ? CHART_COLORS.axis : CHART_COLORS.grid, t === 0 ? 1.5 : 1);
    cv.text(xx, p.y + p.h + 4, fmtNum((max * t) / ticks), CHART_COLORS.muted, 2, 'center');
  }
  const n = values.length;
  const rowH = p.h / n;
  const barH = rowH * 0.62;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const bw = (p.w * v) / max;
    const by = p.y + rowH * i + (rowH - barH) / 2;
    cv.fillRect(p.x, by, bw, barH, colorAt(i));
    cv.text(p.x - 6, by + barH / 2 - PngCanvas.textHeight(2) / 2, shortLabel(labels[i] ?? ''), CHART_COLORS.shark, 2, 'right');
    if (o.valueLabels !== false)
      cv.text(p.x + bw + 4, by + barH / 2 - PngCanvas.textHeight(2) / 2, fmtNum(v), CHART_COLORS.muted, 2, 'left');
  }
}

// ── Stacked bar ──────────────────────────────────────────────────────────────
function drawStackedBar(cv: PngCanvas, data: ChartData, _o: ChartOptions) {
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  if (!series.length) return drawEmpty(cv);
  const groups = labels.length || series[0].values.length;
  const totals: number[] = [];
  for (let g = 0; g < groups; g++) totals.push(series.reduce((a, s) => a + (s.values[g] ?? 0), 0));
  const p = defaultPlot(cv);
  const max = niceMax(Math.max(1, ...totals));
  const everyN = groups > 14 ? Math.ceil(groups / 14) : 1;
  drawGrid(cv, p, max, labels, everyN);
  const groupW = p.w / groups;
  const barW = groupW * 0.62;
  for (let g = 0; g < groups; g++) {
    let acc = 0;
    const bx = p.x + groupW * g + (groupW - barW) / 2;
    for (let s = 0; s < series.length; s++) {
      const v = series[s].values[g] ?? 0;
      const bh = (p.h * v) / max;
      const by = p.y + p.h - (p.h * acc) / max - bh;
      cv.fillRect(bx, by, barW, bh, seriesColor(series[s], s));
      acc += v;
    }
  }
}

// ── Donut (≤ maxSlices, rest folded into "Other") ────────────────────────────
function drawDonut(cv: PngCanvas, data: ChartData, o: ChartOptions) {
  const labels = data.labels ?? [];
  const values = data.series?.[0]?.values ?? [];
  if (!values.length || values.every((v) => v === 0)) return drawEmpty(cv);
  const maxSlices = o.maxSlices ?? 5;
  const pairs = labels.map((l, i) => ({ label: l, value: values[i] ?? 0 })).sort((a, b) => b.value - a.value);
  let slices = pairs;
  if (pairs.length > maxSlices) {
    const head = pairs.slice(0, maxSlices - 1);
    const rest = pairs.slice(maxSlices - 1).reduce((a, s) => a + s.value, 0);
    slices = [...head, { label: 'Other', value: rest }];
  }
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const legendW = o.legend === false ? 0 : Math.min(220, Math.floor(cv.width * 0.34));
  const cx = (cv.width - legendW) / 2;
  const cy = cv.height / 2;
  const rOuter = Math.min((cv.width - legendW) / 2, cv.height / 2) - 14;
  const rInner = rOuter * 0.58;
  let ang = -Math.PI / 2; // start at 12 o'clock
  if (ang < 0) ang += Math.PI * 2;
  slices.forEach((s, i) => {
    const sweep = (s.value / total) * Math.PI * 2;
    cv.fillArcRing(cx, cy, rOuter, rInner, ang, ang + sweep, colorAt(i));
    ang += sweep;
  });
  cv.text(cx, cy - PngCanvas.textHeight(3) / 2, fmtNum(total), CHART_COLORS.shark, 3, 'center');
  if (legendW > 0) {
    const lx = cv.width - legendW + 8;
    const rows = slices.length;
    const gap = Math.min(26, cv.height / (rows + 1));
    let ly = cy - (rows * gap) / 2 + 4;
    slices.forEach((s, i) => {
      cv.fillRect(lx, ly, 12, 12, colorAt(i));
      const pct = Math.round((s.value / total) * 100);
      cv.text(lx + 18, ly + 1, `${shortLabel(s.label)} ${pct}%`, CHART_COLORS.shark, 2, 'left');
      ly += gap;
    });
  }
}

// ── Scatter ──────────────────────────────────────────────────────────────────
function drawScatter(cv: PngCanvas, data: ChartData, _o: ChartOptions) {
  const pts = data.points ?? [];
  if (!pts.length) return drawEmpty(cv);
  const p = defaultPlot(cv);
  const xMax = niceMax(Math.max(1, ...pts.map((q) => q.x)));
  const yMax = niceMax(Math.max(1, ...pts.map((q) => q.y)));
  const ticks = 4;
  cv.hLine(p.x, p.x + p.w, p.y + p.h, CHART_COLORS.axis, 1.5);
  cv.vLine(p.x, p.y, p.y + p.h, CHART_COLORS.axis, 1.5);
  for (let t = 0; t <= ticks; t++) {
    const yy = p.y + p.h - (p.h * t) / ticks;
    if (t > 0) cv.hLine(p.x, p.x + p.w, yy, CHART_COLORS.grid, 1);
    cv.text(p.x - 6, yy - PngCanvas.textHeight(2) / 2, fmtNum((yMax * t) / ticks), CHART_COLORS.muted, 2, 'right');
    const xx = p.x + (p.w * t) / ticks;
    cv.text(xx, p.y + p.h + 6, fmtNum((xMax * t) / ticks), CHART_COLORS.muted, 2, 'center');
  }
  for (const q of pts) {
    const px = p.x + (p.w * q.x) / xMax;
    const py = p.y + p.h - (p.h * q.y) / yMax;
    cv.fillCircle(px, py, 4, CHART_COLORS.cyan, 0.85);
  }
}

// ── Sparkline (bare mini line, no axes) ──────────────────────────────────────
function drawSparkline(cv: PngCanvas, data: ChartData, _o: ChartOptions) {
  const values = data.values ?? data.series?.[0]?.values ?? [];
  if (!values.length) return drawEmpty(cv);
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = cv.width - pad * 2;
  const hh = cv.height - pad * 2;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts: Array<[number, number]> = values.map((v, i) => [
    pad + step * i,
    pad + hh - (hh * (v - min)) / range,
  ]);
  const poly: Array<[number, number]> = [[pad, cv.height - pad], ...pts, [pad + step * (pts.length - 1), cv.height - pad]];
  cv.fillPolygon(poly, CHART_COLORS.cyan, 0.2);
  for (let i = 0; i + 1 < pts.length; i++)
    cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], CHART_COLORS.primary, 2);
  if (pts.length) cv.fillCircle(pts[pts.length - 1][0], pts[pts.length - 1][1], 3, CHART_COLORS.gold);
}

// ── Funnel (custom draw — narrowing stacked trapezoids, top → bottom) ────────
function drawFunnel(cv: PngCanvas, data: ChartData, _o: ChartOptions) {
  const labels = data.labels ?? [];
  const values = data.series?.[0]?.values ?? [];
  if (!values.length) return drawEmpty(cv);
  const max = Math.max(1, ...values);
  const n = values.length;
  const topPad = 14;
  const bottomPad = 14;
  const usableH = cv.height - topPad - bottomPad;
  const rowH = usableH / n;
  const gap = Math.min(6, rowH * 0.18);
  const cx = cv.width / 2;
  const maxHalf = cv.width * 0.42;
  for (let i = 0; i < n; i++) {
    const wTop = (values[i] / max) * maxHalf;
    const wBot = (((values[i + 1] ?? values[i]) / max) * maxHalf) || wTop * 0.6;
    const yTop = topPad + rowH * i;
    const yBot = yTop + rowH - gap;
    cv.fillPolygon(
      [
        [cx - wTop, yTop],
        [cx + wTop, yTop],
        [cx + wBot, yBot],
        [cx - wBot, yBot],
      ],
      colorAt(i)
    );
    const pct = Math.round((values[i] / max) * 100);
    const label = `${shortLabel(labels[i] ?? '')} ${fmtNum(values[i])} ${pct}%`;
    cv.text(cx, (yTop + yBot) / 2 - PngCanvas.textHeight(2) / 2, label, CHART_COLORS.white, 2, 'center');
  }
}

// ── Heatmap (custom draw — matrix of intensity cells) ────────────────────────
function drawHeatmap(cv: PngCanvas, data: ChartData, _o: ChartOptions) {
  const matrix = data.matrix ?? [];
  const rows = matrix.length;
  const cols = rows ? matrix[0].length : 0;
  if (!rows || !cols) return drawEmpty(cv);
  const yLabels = data.yLabels ?? [];
  const xLabels = data.xLabels ?? [];
  const labelW = Math.max(0, ...yLabels.map((l) => PngCanvas.textWidth(shortLabel(l), 2))) + 8;
  const bottomH = xLabels.length ? PngCanvas.textHeight(2) + 8 : 6;
  const p: Plot = { x: 8 + labelW, y: 10, w: cv.width - (8 + labelW) - 10, h: cv.height - 10 - bottomH };
  let max = 0;
  for (const r of matrix) for (const v of r) if (v > max) max = v;
  max = max || 1;
  const cw = p.w / cols;
  const ch = p.h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = matrix[r][c] / max;
      const [rr, gg, bb] = mix(CHART_COLORS.white, CHART_COLORS.primary, 0.12 + t * 0.88);
      cv.fillRect(p.x + c * cw, p.y + r * ch, cw - 1, ch - 1, `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`);
    }
    if (yLabels[r]) cv.text(p.x - 6, p.y + ch * r + ch / 2 - PngCanvas.textHeight(2) / 2, shortLabel(yLabels[r]), CHART_COLORS.shark, 2, 'right');
  }
  for (let c = 0; c < cols; c++)
    if (xLabels[c]) cv.text(p.x + cw * c + cw / 2, p.y + p.h + 4, shortLabel(xLabels[c]), CHART_COLORS.muted, 2, 'center');
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

// ── Fallbacks ────────────────────────────────────────────────────────────────
function drawEmpty(cv: PngCanvas) {
  cv.text(cv.width / 2, cv.height / 2 - PngCanvas.textHeight(2) / 2, 'NO DATA', CHART_COLORS.muted, 2, 'center');
}

function drawPlaceholder(cv: PngCanvas, type: string) {
  cv.strokeRect(6, 6, cv.width - 12, cv.height - 12, CHART_COLORS.grid, 2);
  cv.text(cv.width / 2, cv.height / 2 - PngCanvas.textHeight(2), 'CHART NOT YET AVAILABLE', CHART_COLORS.muted, 2, 'center');
  cv.text(cv.width / 2, cv.height / 2 + 6, type.toUpperCase(), CHART_COLORS.axis, 2, 'center');
}

export { CHART_SEQUENCE };
