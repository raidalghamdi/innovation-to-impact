'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

const CRITERIA = [
  { key: 'impact', label_ar: 'الأثر', label_en: 'Impact', weight: 0.35 },
  { key: 'feasibility', label_ar: 'الجدوى', label_en: 'Feasibility', weight: 0.25 },
  { key: 'strategic_fit', label_ar: 'المواءمة الاستراتيجية', label_en: 'Strategic fit', weight: 0.25 },
  { key: 'cost', label_ar: 'الكفاءة المالية', label_en: 'Cost efficiency', weight: 0.15 },
];

export function EvaluationScorecard({ locale }: { locale: string }) {
  const t = useTranslations('evaluation');
  const tc = useTranslations('common');
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, 5]))
  );
  const [conflict, setConflict] = useState(false);
  const [comments, setComments] = useState('');

  const total = useMemo(
    () =>
      CRITERIA.reduce((sum, c) => sum + (scores[c.key] ?? 0) * c.weight, 0) * 10,
    [scores]
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="teal-header">
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('criteria')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('weight')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase">{t('score')} (0–10)</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.key} className="border-t border-border">
                  <td className="px-4 py-3">{locale === 'ar' ? c.label_ar : c.label_en}</td>
                  <td className="px-4 py-3">{Math.round(c.weight * 100)}%</td>
                  <td className="px-4 py-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={scores[c.key]}
                      onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
                      className="w-40 accent-[#01696F]"
                    />
                    <span className="ms-2 font-medium">{scores[c.key]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between rounded-md bg-brand-teal-light p-4">
          <span className="font-medium text-brand-teal">{t('totalScore')}</span>
          <span className="text-2xl font-bold text-brand-teal">{total.toFixed(1)}</span>
        </div>

        <Textarea
          placeholder={t('comments')}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conflict}
            onChange={(e) => setConflict(e.target.checked)}
            className="h-4 w-4 accent-[#01696F]"
          />
          {t('conflict')}
        </label>

        <Button disabled={conflict}>{tc('submit')}</Button>
      </CardContent>
    </Card>
  );
}
