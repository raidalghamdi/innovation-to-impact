// Central KPI registry. Every KpiCard reads its label + formatting + "which
// direction is good" from here so cards render consistently and the exec
// summary endpoint and the UI agree on what each metric means.
import { formatSAR } from '@/lib/utils';

export type KpiFormat = 'int' | 'decimal' | 'percent' | 'currency';
export type KpiDirection = 'up_good' | 'down_good' | 'neutral';

export type KpiDefinition = {
  id: string;
  label_ar: string;
  label_en: string;
  format: KpiFormat;
  direction: KpiDirection;
  unit?: string;
};

export const KPI_DEFINITIONS: Record<string, KpiDefinition> = {
  ideas_submitted: {
    id: 'ideas_submitted',
    label_ar: 'الأفكار المقدمة',
    label_en: 'Ideas submitted',
    format: 'int',
    direction: 'up_good',
  },
  avg_cycle_time: {
    id: 'avg_cycle_time',
    label_ar: 'متوسط زمن الدورة',
    label_en: 'Avg cycle time',
    format: 'decimal',
    direction: 'down_good',
    unit: 'days',
  },
  approval_rate: {
    id: 'approval_rate',
    label_ar: 'معدل الاعتماد',
    label_en: 'Approval rate',
    format: 'percent',
    direction: 'up_good',
  },
  active_pilots: {
    id: 'active_pilots',
    label_ar: 'التجارب النشطة',
    label_en: 'Active pilots',
    format: 'int',
    direction: 'up_good',
  },
  roi_ytd: {
    id: 'roi_ytd',
    label_ar: 'العائد منذ بداية العام',
    label_en: 'ROI YTD',
    format: 'currency',
    direction: 'up_good',
  },
  evaluators_active: {
    id: 'evaluators_active',
    label_ar: 'المقيّمون النشطون',
    label_en: 'Evaluators active',
    format: 'int',
    direction: 'up_good',
  },
};

export function kpiLabel(id: string, locale: string): string {
  const def = KPI_DEFINITIONS[id];
  if (!def) return id;
  return locale === 'ar' ? def.label_ar : def.label_en;
}

// Format a raw numeric KPI value for display per its registry format.
export function formatKpiValue(format: KpiFormat, value: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  const intl = locale === 'ar' ? 'ar-SA' : 'en-US';
  switch (format) {
    case 'percent':
      return `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(value)}%`;
    case 'decimal':
      return new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(value);
    case 'currency':
      return `${formatSAR(value, locale)} SAR`;
    case 'int':
    default:
      return new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(Math.round(value));
  }
}

// Signed percentage change between two periods. Returns null when there is no
// meaningful prior value to compare against.
export function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
