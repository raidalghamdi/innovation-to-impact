'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { EvaluationScorecard } from '@/components/evaluation-scorecard';
import { cn } from '@/lib/utils';

type QueueIdea = {
  id: string;
  code: string;
  title_ar: string;
  title_en: string;
  status: string;
};

export function EvaluationWorkspace({
  queue,
  locale,
}: {
  queue: QueueIdea[];
  locale: string;
}) {
  const t = useTranslations('evaluation');
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    queue.length ? queue[0].id : null
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('queueEmpty')}
            </p>
          ) : (
            queue.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setSelectedId(i.id)}
                className={cn(
                  'w-full rounded-md border p-3 text-start transition-colors',
                  selectedId === i.id
                    ? 'border-brand-teal bg-brand-teal-light'
                    : 'border-border hover:border-brand-teal'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-gold">{i.code}</span>
                  <StatusBadge status={i.status} locale={locale} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm font-medium">
                  {locale === 'ar' ? i.title_ar : i.title_en}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        <h2 className="section-title mb-3">{t('scorecard')}</h2>
        {selectedId ? (
          <EvaluationScorecard
            key={selectedId}
            ideaId={selectedId}
            onSaved={() => router.refresh()}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('selectIdea')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
