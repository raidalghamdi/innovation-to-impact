'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Upload, FileSpreadsheet } from 'lucide-react';

type Row = { code: string; title: string; duplicate: boolean; confidence: number };

const SAMPLE: Row[] = [
  { code: 'LEG-2019-114', title: 'Price monitoring dashboard', duplicate: true, confidence: 0.86 },
  { code: 'LEG-2020-007', title: 'Merger e-filing concept', duplicate: true, confidence: 0.74 },
  { code: 'LEG-2018-221', title: 'Consumer hotline analytics', duplicate: false, confidence: 0.12 },
  { code: 'LEG-2021-045', title: 'Sector benchmarking tool', duplicate: false, confidence: 0.21 },
  { code: 'LEG-2017-009', title: 'Open competition data portal', duplicate: false, confidence: 0.08 },
];

export function MigrateWizard({ locale }: { locale: string }) {
  const t = useTranslations('migrate');
  const [uploaded, setUploaded] = useState(false);

  const dupes = SAMPLE.filter((r) => r.duplicate);
  const news = SAMPLE.filter((r) => !r.duplicate);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 py-12 text-center">
            <Upload className="h-8 w-8 text-brand-teal" />
            <span className="text-sm font-medium">{t('upload')}</span>
            <span className="text-xs text-muted-foreground">CSV · XLSX</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={() => setUploaded(true)}
            />
          </label>
          {!uploaded && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setUploaded(true)}>
                <FileSpreadsheet className="h-4 w-4" />
                {t('upload')} (demo)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {uploaded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('dedupePreview')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-2xl font-semibold text-emerald-700">{news.length}</p>
                <p className="text-sm text-emerald-700">{t('newRecords')}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-2xl font-semibold text-amber-800">{dupes.length}</p>
                <p className="text-sm text-amber-800">{t('duplicates')}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="teal-header">
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Code</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Title</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Confidence</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.map((r) => (
                    <tr key={r.code} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                      <td className="px-4 py-2">{r.title}</td>
                      <td className="px-4 py-2">{Math.round(r.confidence * 100)}%</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={r.duplicate ? 'pending' : 'open'} locale={locale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button variant="gold">{t('import')}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
