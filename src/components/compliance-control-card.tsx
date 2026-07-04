'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateControlStatus } from '@/app/[locale]/compliance/actions';
import { EvidenceUploader } from '@/components/evidence-uploader';
import type { ComplianceControlV2 } from '@/lib/data';

const STATUS_STYLE: Record<string, string> = {
  met: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-amber-100 text-amber-800',
  not_started: 'bg-gray-200 text-gray-600',
  not_applicable: 'bg-muted text-muted-foreground',
};

const STATUS_KEY: Record<string, string> = {
  met: 'met',
  in_progress: 'inProgress',
  not_started: 'notStarted',
  not_applicable: 'notApplicable',
};

const STATUSES = ['not_started', 'in_progress', 'met', 'not_applicable'];

export function ComplianceControlCard({
  control,
  locale,
  isAdmin,
}: {
  control: ComplianceControlV2;
  locale: string;
  isAdmin: boolean;
}) {
  const t = useTranslations('compliance');
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(control.status);
  const [reviewed, setReviewed] = useState(control.last_reviewed_at?.slice(0, 10) ?? '');
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const title = locale === 'ar' ? control.title_ar : control.title_en;
  const description = locale === 'ar' ? control.description_ar : control.description_en;

  function save() {
    setError(false);
    startTransition(async () => {
      const res = await updateControlStatus({
        id: control.id,
        status,
        lastReviewedAt: reviewed || null,
      });
      if (res.ok) setEditing(false);
      else setError(true);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground" dir="ltr">{control.control_code}</p>
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.not_started}`}>
            {t(STATUS_KEY[status] ?? 'notStarted')}
          </span>
        </div>

        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{t('mappedFeatures')}</p>
          {control.mapped_feature_paths?.length ? (
            <ul className="mt-1 space-y-0.5">
              {control.mapped_feature_paths.map((p) => (
                <li key={p} className="font-mono text-xs text-brand-teal" dir="ltr">{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{t('evidence')}</p>
          {control.evidence_urls?.length ? (
            <ul className="mt-1 space-y-0.5">
              {control.evidence_urls.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-teal underline" dir="ltr">{u}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t('noEvidence')}</p>
          )}
          {isAdmin && (
            <div className="mt-3">
              <EvidenceUploader
                entityType="compliance_control"
                entityId={control.id}
                context="compliance"
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                locale={locale}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('lastReviewed')}: <span dir="ltr">{control.last_reviewed_at?.slice(0, 10) ?? t('never')}</span>
        </p>

        {isAdmin && (
          <div className="border-t border-border pt-3">
            {editing ? (
              <div className="space-y-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t(STATUS_KEY[s])}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={reviewed}
                  onChange={(e) => setReviewed(e.target.value)}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={save} disabled={pending}>{t('save')}</Button>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>✕</Button>
                </div>
                {error && <p className="text-xs font-medium text-red-600">{t('saveError')}</p>}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>{t('editStatus')}</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
