// Shared chart theme + RTL helpers. Every wrapper in this folder pulls its
// color sequence and locale-aware number formatting from here so the analytics
// surface stays visually consistent and no raw recharts primitive is themed
// ad-hoc elsewhere.
import { useLocale } from 'next-intl';

// design-foundations chart sequence (teal → terra → dark teal → cyan → mauve →
// gold → olive → brown). Series colours cycle through this list.
export const CHART_COLORS = [
  '#20808D',
  '#A84B2F',
  '#1B474D',
  '#BCE2E7',
  '#944454',
  '#FFC553',
  '#848456',
  '#6E522B',
] as const;

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// A single plotted measure. `color` overrides the sequence default.
export type ChartSeries = {
  key: string;
  name?: string;
  color?: string;
};

export type ChartProps = {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: ChartSeries[];
  title?: string;
  height?: number;
  className?: string;
};

// Locale-aware number formatting. Arabic uses the ar-SA locale (Eastern Arabic
// numerals) to match the rest of the RTL surface; everything else uses en-US.
export function formatChartNumber(locale: string, value: number): string {
  if (!Number.isFinite(value)) return '';
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 1,
  });
  return nf.format(value);
}

// Reads the active locale and derives RTL orientation. Wrappers use this to flip
// axis order, tooltip side, and legend alignment for Arabic.
export function useChartLocale(): { locale: string; isRtl: boolean } {
  const locale = useLocale();
  return { locale, isRtl: locale === 'ar' };
}
