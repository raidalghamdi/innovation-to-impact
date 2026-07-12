// Chart palette — the ONLY source of chart colors. Pulled from the platform
// design-foundations / tailwind brand tokens so charts match the website and
// the branded PDF/PPTX chrome.
//
//   primary  #1C4854  Moon Raker — dark surface, primary series, axis text
//   cyan     #3FBAC8  vibrant teal-cyan — secondary series / accents
//   gold     #E0A82E  vibrant gold — tertiary series / highlights
//
// The extended sequence below is the categorical order used whenever a chart
// needs more than three distinct colors (donut slices, stacked segments,
// multi-series bars). Colors after the three brand anchors are tints/shades
// derived to stay on-brand while remaining visually separable.

export type RGB = [number, number, number];

export const CHART_COLORS = {
  primary: '#1C4854', // Moon Raker
  cyan: '#3FBAC8',
  gold: '#E0A82E',
  // supporting neutrals + tints from the foundations
  swansDown: '#D8EFE5',
  hummingBird: '#CFEDF8',
  shark: '#232529',
  muted: '#5C5F66',
  grid: '#E3E8EA',
  axis: '#8A9297',
  white: '#FFFFFF',
  positive: '#3FBAC8',
  negative: '#A12C7B',
} as const;

// Categorical sequence for multi-series / multi-slice charts.
export const CHART_SEQUENCE: string[] = [
  '#1C4854', // Moon Raker (primary)
  '#3FBAC8', // cyan
  '#E0A82E', // gold
  '#7ED5DE', // cyan-light
  '#0F2D36', // teal-dark
  '#A12C7B', // magenta (error/negative accent)
  '#4ABFCD', // cyan-alt
  '#F5EDD6', // gold-light
  '#5C5F66', // muted
  '#9BC9D4', // derived soft cyan
];

export function colorAt(i: number): string {
  return CHART_SEQUENCE[i % CHART_SEQUENCE.length];
}

export function hexToRgb(hex: string): RGB {
  const n = hex.replace('#', '');
  const v =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n;
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

// Mix two colors by t in [0,1] (0 → a, 1 → b). Used for tints/shades.
export function mix(a: string, b: string, t: number): RGB {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return [
    Math.round(ca[0] + (cb[0] - ca[0]) * t),
    Math.round(ca[1] + (cb[1] - ca[1]) * t),
    Math.round(ca[2] + (cb[2] - ca[2]) * t),
  ];
}
