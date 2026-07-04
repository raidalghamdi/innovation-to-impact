'use client';

import { useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { pickFromRow } from '@/lib/i18n-content';
import { BarChart } from './BarChart';

type PillarRow = {
  theme_id: string;
  name_ar?: string | null;
  name_en?: string | null;
  title_ar?: string | null;
  title_en?: string | null;
  count: number;
};

// Exec-dashboard pillar chart: clicking a bar drills into that theme.
export function PillarBarChart({ rows, title }: { rows: PillarRow[]; title?: string }) {
  const router = useRouter();
  const locale = useLocale();

  const data = rows.map((r) => ({
    label: pickFromRow(r, r.name_en !== undefined || r.name_ar !== undefined ? 'name' : 'title', locale) || '—',
    count: r.count,
    theme_id: r.theme_id,
  }));

  return (
    <BarChart
      data={data}
      xKey="label"
      series={[{ key: 'count', name: title ?? 'count' }]}
      title={title}
      onSelect={(row) => {
        const id = row.theme_id;
        if (typeof id === 'string') router.push(`/analytics/pillars/${id}`);
      }}
    />
  );
}
