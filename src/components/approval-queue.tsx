'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  bulkDecideApprovalsAction,
  decideApprovalAction,
  type ApprovalTarget,
} from '@/app/[locale]/approvals/actions';

export type ApprovalCard = {
  instanceId: string;
  stepId: string;
  entityType: string;
  entityLabel: string;
  chainName: string | null;
  stepLabel: string | null;
  stepOrder: number;
  minApprovers: number;
  priorApprovers: string[];
};

export function ApprovalQueue({ initial }: { initial: ApprovalCard[] }) {
  const t = useTranslations('approvals');
  const [cards, setCards] = useState<ApprovalCard[]>(initial);
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function targetFor(c: ApprovalCard): ApprovalTarget {
    return { instanceId: c.instanceId, stepId: c.stepId };
  }

  function single(c: ApprovalCard, decision: 'approve' | 'reject') {
    setStatus(null);
    startTransition(async () => {
      const res = await decideApprovalAction(targetFor(c), decision, comment || undefined);
      if (!res.ok) {
        setStatus(t('actionError'));
        return;
      }
      setCards((prev) => prev.filter((x) => x.instanceId !== c.instanceId));
      setComment('');
    });
  }

  function bulkDecide(decision: 'approve' | 'reject') {
    const targets = cards.filter((c) => selected.has(c.instanceId)).map(targetFor);
    if (!targets.length) return;
    setStatus(null);
    startTransition(async () => {
      const res = await bulkDecideApprovalsAction(targets, decision, comment || undefined);
      const failedIds = new Set((res.failures ?? []).map((f) => f.instanceId));
      setCards((prev) => prev.filter((c) => !selected.has(c.instanceId) || failedIds.has(c.instanceId)));
      setSelected(new Set());
      setComment('');
      setStatus(
        res.ok
          ? t('bulkOk', { n: res.succeeded ?? 0 })
          : t('bulkPartial', { ok: res.succeeded ?? 0, failed: (res.failures ?? []).length })
      );
    });
  }

  if (!cards.length) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={bulk ? 'default' : 'outline'} size="sm" onClick={() => setBulk((b) => !b)}>
          <Layers className="me-1 h-3.5 w-3.5" />
          {t('bulkMode')}
        </Button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>

      {bulk && (
        <Card className="border-brand-teal/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium">{t('selected', { n: selectedCount })}</span>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('sharedComment')}
              className="min-w-[16rem] flex-1 text-xs"
              rows={2}
            />
            <Button size="sm" disabled={!selectedCount} onClick={() => bulkDecide('approve')}>
              <Check className="me-1 h-3.5 w-3.5" />
              {t('approveN', { n: selectedCount })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedCount}
              onClick={() => bulkDecide('reject')}
            >
              <X className="me-1 h-3.5 w-3.5" />
              {t('rejectN', { n: selectedCount })}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {cards.map((c) => (
          <Card key={c.instanceId}>
            <CardContent className="flex flex-wrap items-start gap-3 p-4">
              {bulk && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={selected.has(c.instanceId)}
                  onChange={() => toggle(c.instanceId)}
                  aria-label={c.entityLabel}
                />
              )}
              <div className="min-w-[12rem] flex-1">
                <p className="font-medium">{c.entityLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {c.chainName ?? c.entityType}
                  {' · '}
                  {c.stepLabel ?? t('step', { n: c.stepOrder })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('progress', { got: c.priorApprovers.length, need: c.minApprovers })}
                </p>
              </div>
              {!bulk && (
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => single(c, 'approve')}>
                      <Check className="me-1 h-3.5 w-3.5" />
                      {t('approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => single(c, 'reject')}>
                      <X className="me-1 h-3.5 w-3.5" />
                      {t('reject')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!bulk && (
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('comment')}
          className="w-full text-xs"
          rows={2}
        />
      )}
    </div>
  );
}
