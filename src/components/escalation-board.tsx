'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpCircle, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { pick } from '@/lib/i18n-content';
import {
  ackEscalationAction,
  bumpEscalationAction,
  resolveEscalationAction,
} from '@/app/[locale]/admin/escalations/actions';

export type EscalationRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  opened_at: string;
  reason_ar: string | null;
  reason_en: string | null;
  current_level: number;
  current_owner_id: string | null;
  owner_name: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'cancelled';
};

const LEVEL_TONE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-700',
};

// Where an escalation's source entity lives, so the ref is clickable.
function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'idea':
      return `/ideas/${entityId}`;
    case 'evaluation':
      return `/evaluator`;
    case 'committee_decision':
      return `/committee`;
    default:
      return null;
  }
}

function ageLabel(iso: string, unit: (k: string, v: { n: number }) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return unit('days', { n: days });
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return unit('hours', { n: hours });
  return unit('minutes', { n: Math.max(1, Math.floor(ms / 60_000)) });
}

export function EscalationBoard({
  initial,
  locale,
}: {
  initial: EscalationRow[];
  locale: string;
}) {
  const t = useTranslations('escalations');
  const [rows, setRows] = useState<EscalationRow[]>(initial);
  const [note, setNote] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, drop: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      setActive(null);
      setNote('');
      if (drop) setRows((prev) => prev.filter((r) => r.id !== id));
      else
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: 'acknowledged', current_level: Math.min(3, r.current_level) }
              : r
          )
        );
    });
  }

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{t('actionError')}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{t('colEntity')}</th>
              <th className="px-3 py-2 text-start">{t('colLevel')}</th>
              <th className="px-3 py-2 text-start">{t('colOwner')}</th>
              <th className="px-3 py-2 text-start">{t('colAge')}</th>
              <th className="px-3 py-2 text-start">{t('colStatus')}</th>
              <th className="px-3 py-2 text-end">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = entityHref(r.entity_type, r.entity_id);
              const label = `${t(`entity.${r.entity_type}`)} · ${r.entity_id.slice(0, 8)}`;
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {href ? (
                      <Link href={href} className="text-brand-teal hover:underline">
                        {label}
                      </Link>
                    ) : (
                      <span>{label}</span>
                    )}
                    <p className="mt-0.5 max-w-[22rem] text-xs text-muted-foreground">
                      {pick(r.reason_ar, r.reason_en, locale) ?? ''}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_TONE[r.current_level] ?? LEVEL_TONE[1]}`}
                    >
                      {t(`level.${r.current_level}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.owner_name ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {ageLabel(r.opened_at, (k, v) => t(`age.${k}`, v))}
                  </td>
                  <td className="px-3 py-2">{t(`statusLabel.${r.status}`)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActive(active === r.id ? null : r.id)}
                      >
                        <Eye className="me-1 h-3.5 w-3.5" />
                        {t('act.detail')}
                      </Button>
                      {r.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => run(r.id, () => ackEscalationAction(r.id, note), false)}
                        >
                          {t('act.ack')}
                        </Button>
                      )}
                      {r.current_level < 3 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => run(r.id, () => bumpEscalationAction(r.id), false)}
                        >
                          <ArrowUpCircle className="me-1 h-3.5 w-3.5" />
                          {t('act.bump')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => run(r.id, () => resolveEscalationAction(r.id, note), true)}
                      >
                        <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                        {t('act.resolve')}
                      </Button>
                    </div>
                    {active === r.id && (
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t('notePlaceholder')}
                        className="mt-2 w-full text-xs"
                        rows={2}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
