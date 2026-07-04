'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkloadRow, WorkloadCell } from '@/lib/data';

// Bucket → the assignments-table filter it maps to when a cell is clicked.
// due-soon / overdue aren't distinct DB statuses (both are pending rows), so
// they narrow to status=pending; the admin can eyeball the due dates.
const COLUMNS: { key: keyof WorkloadCell; status: string }[] = [
  { key: 'pending', status: 'pending' },
  { key: 'dueSoon', status: 'pending' },
  { key: 'overdue', status: 'pending' },
  { key: 'completedRecent', status: 'completed' },
];

// Map a count to a Tailwind teal shade. Empty cells stay muted so the heat is
// legible. Shades are hard-coded (not interpolated) so Tailwind keeps them.
function cellClass(count: number): string {
  if (count <= 0) return 'bg-muted text-muted-foreground';
  if (count === 1) return 'bg-teal-100 text-teal-900';
  if (count === 2) return 'bg-teal-200 text-teal-900';
  if (count === 3) return 'bg-teal-300 text-teal-900';
  if (count === 4) return 'bg-teal-400 text-white';
  if (count <= 6) return 'bg-teal-500 text-white';
  if (count <= 9) return 'bg-teal-600 text-white';
  return 'bg-teal-700 text-white';
}

export function WorkloadHeatmap({ rows, locale }: { rows: WorkloadRow[]; locale: string }) {
  const t = useTranslations('admin.assignments');

  if (rows.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('heatmapTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('heatmapEmpty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-brand-teal">{t('heatmapTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div
            className="grid items-center gap-1"
            style={{ gridTemplateColumns: `minmax(8rem,1fr) repeat(${COLUMNS.length}, minmax(5rem,1fr))` }}
          >
            <div />
            {COLUMNS.map((c) => (
              <div key={c.key} className="px-1 pb-2 text-center text-xs font-semibold text-muted-foreground">
                {t(`bucket_${c.key}`)}
              </div>
            ))}

            {rows.map((row) => (
              <FragmentRow key={row.evaluatorId} row={row} locale={locale} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FragmentRow({ row, locale }: { row: WorkloadRow; locale: string }) {
  return (
    <>
      <div className="truncate px-1 py-2 text-sm font-medium text-foreground" dir="ltr" title={row.evaluatorLabel}>
        {row.evaluatorLabel}
      </div>
      {COLUMNS.map((c) => {
        const count = row.cells[c.key];
        const href = `/${locale}/admin/assignments?evaluatorId=${encodeURIComponent(row.evaluatorId)}&status=${c.status}`;
        return (
          <Link
            key={c.key}
            href={href}
            className={`flex h-11 items-center justify-center rounded-md text-sm font-semibold transition-opacity hover:opacity-80 ${cellClass(count)}`}
          >
            {count}
          </Link>
        );
      })}
    </>
  );
}
