'use client';

// Final ranking control (R43, admin only). Shows the current Top N, runs a
// non-destructive Preview (POST /api/admin/final-ranking/preview) rendering the
// would-approve vs would-not-select lists with ranks and committee scores, and
// a Run action (POST .../run) gated behind window.confirm with an irreversible
// warning.
import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToastStack, ToastStack } from '@/components/ui/toast';

type PreviewItem = {
  id: string;
  code: string | null;
  title_en: string | null;
  title_ar: string | null;
  strategic_theme_id: string | null;
  committee_final_score: number | null;
  rank: number | null;
};

type PreviewResult = {
  topN: number;
  wouldApproveCount: number;
  wouldNotSelectCount: number;
  wouldApprove: PreviewItem[];
  wouldNotSelect: PreviewItem[];
};

export function FinalRankingControl() {
  const t = useTranslations('admin.finalRanking');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { toasts, push, dismiss } = useToastStack();

  const [topN, setTopN] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && typeof j.top_n === 'number') setTopN(j.top_n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const title = (item: PreviewItem) =>
    (isAr ? item.title_ar || item.title_en : item.title_en || item.title_ar) || item.code || item.id;

  async function runPreview() {
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/final-ranking/preview', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setPreview(j as PreviewResult);
        if (typeof j.topN === 'number') setTopN(j.topN);
      } else {
        push({ title: t('previewFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('previewFailed') });
    } finally {
      setPreviewing(false);
    }
  }

  async function run() {
    if (!window.confirm(t('runConfirm'))) return;
    setRunning(true);
    try {
      const res = await fetch('/api/admin/final-ranking/run', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        push({
          title: t('runDone', {
            approved: j.approved ?? 0,
            notSelected: j.notSelected ?? 0,
          }),
        });
        await runPreview();
      } else {
        push({ title: t('runFailed'), description: j.error ?? undefined });
      }
    } catch {
      push({ title: t('runFailed') });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            {t('currentTopN')}:{' '}
            <span className="font-semibold">{topN ?? '—'}</span>
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {t('irreversible')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runPreview} disabled={previewing}>
              {previewing ? t('previewing') : t('preview')}
            </Button>
            <Button
              variant="destructive"
              onClick={run}
              disabled={running || !preview}
            >
              {running ? t('running') : t('run')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RankingList
            title={t('wouldApprove')}
            count={preview.wouldApproveCount}
            items={preview.wouldApprove}
            titleOf={title}
            rankLabel={t('rank')}
            scoreLabel={t('score')}
            emptyLabel={t('none')}
            variant="success"
          />
          <RankingList
            title={t('wouldNotSelect')}
            count={preview.wouldNotSelectCount}
            items={preview.wouldNotSelect}
            titleOf={title}
            rankLabel={t('rank')}
            scoreLabel={t('score')}
            emptyLabel={t('none')}
            variant="secondary"
          />
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function RankingList({
  title,
  count,
  items,
  titleOf,
  rankLabel,
  scoreLabel,
  emptyLabel,
  variant,
}: {
  title: string;
  count: number;
  items: PreviewItem[];
  titleOf: (item: PreviewItem) => string;
  rankLabel: string;
  scoreLabel: string;
  emptyLabel: string;
  variant: 'success' | 'secondary';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant={variant}>{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{titleOf(item)}</div>
                  {item.code && (
                    <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {item.rank != null && (
                    <span>
                      {rankLabel} {item.rank}
                    </span>
                  )}
                  {item.committee_final_score != null && (
                    <span>
                      {scoreLabel} {Number(item.committee_final_score).toFixed(2)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
