'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToastStack, ToastStack } from '@/components/ui/toast';
import { UPLOAD_ACCEPT_ATTR } from '@/lib/evidence-types';
import {
  persistPostPassAttachments,
  countPostPassAttachments,
} from '@/app/[locale]/ideas/[id]/finalize/actions';
import { Paperclip, FileText, CheckCircle2, Send, Star } from 'lucide-react';

export type EvaluationCard = {
  id: string;
  reviewerLabel: string;
  score: number | null;
  comment: string | null;
};

type Props = {
  ideaId: string;
  locale: string;
  evaluations: EvaluationCard[];
  averageScore: number | null;
  initialCount: number;
};

/**
 * Post-pass finalize form. Renders the read-only evaluation summary (per-
 * evaluator score + comment cards and the average), a mandatory attachment
 * uploader, and a "Submit to Committee" button disabled until at least one
 * post-pass attachment exists. On successful submit it routes to the idea
 * details page.
 */
export function FinalizeForm({
  ideaId,
  locale,
  evaluations,
  averageScore,
  initialCount,
}: Props) {
  const isAr = locale === 'ar';
  const t = useTranslations('innovator.finalize');
  const router = useRouter();
  const { toasts, push, dismiss } = useToastStack();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [uploads, setUploads] = useState<
    Array<{ id: string; name: string; status: 'uploading' | 'done' | 'error'; error?: string }>
  >([]);

  function onFilesSelected(files: File[]) {
    if (files.length === 0) return;
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploads((prev) => [...prev, { id: key, name: file.name, status: 'uploading' }]);
      startTransition(async () => {
        const fd = new FormData();
        fd.append('files', file);
        const res = await persistPostPassAttachments(ideaId, fd);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === key
              ? { ...u, status: res.ok ? 'done' : 'error', error: res.ok ? undefined : res.error }
              : u
          )
        );
        if (res.ok) {
          setCount(res.count ?? (await countPostPassAttachments(ideaId)));
        } else {
          push({ title: t('uploadRequired'), description: res.error ?? null });
        }
      });
    }
  }

  function handleSubmit() {
    if (count < 1 || submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/submit-to-committee`, {
          method: 'POST',
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok) {
          router.push(`/ideas/${ideaId}` as any);
          return;
        }
        push({
          title: t('submitToCommittee'),
          description:
            (isAr ? json?.message_ar : json?.message_en) ?? json?.error ?? null,
        });
      } catch (err) {
        push({ title: t('submitToCommittee'), description: String(err) });
      } finally {
        setSubmitting(false);
      }
    });
  }

  const hasAttachment = count >= 1;

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <p className="text-sm text-muted-foreground">{t('description')}</p>

      {/* Read-only evaluation summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-brand-teal">
            <span>{t('evaluationSummary')}</span>
            {averageScore !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-sm font-semibold text-brand-teal">
                <Star className="h-4 w-4" />
                {t('averageScore')}: {averageScore.toFixed(1)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('reviewerComments')}</p>
          ) : (
            <ul className="space-y-3">
              {evaluations.map((e) => (
                <li key={e.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {e.reviewerLabel}
                    </span>
                    {e.score !== null && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal">
                        <Star className="h-3.5 w-3.5" />
                        {e.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {e.comment && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {e.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Mandatory uploader */}
      <Card>
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('uploadRequired')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition hover:border-brand-teal/40">
              <Paperclip className="h-6 w-6 text-brand-teal" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">
                {isAr ? 'اسحب الملفات هنا أو اضغط للاختيار' : 'Drag files here or click to choose'}
              </span>
              <span className="text-xs text-muted-foreground">
                {isAr
                  ? 'PDF أو صور أو Office — حتى 10 ميجابايت لكل ملف'
                  : 'PDF, images, or Office files — up to 10MB each'}
              </span>
              <Input
                type="file"
                multiple
                accept={UPLOAD_ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  onFilesSelected(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
            </label>
            {uploads.length > 0 && (
              <ul className="space-y-2">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white p-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      <span className="truncate">{u.name}</span>
                    </span>
                    {u.status === 'uploading' && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isAr ? 'جارٍ الرفع…' : 'Uploading…'}
                      </span>
                    )}
                    {u.status === 'done' && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isAr ? 'تم' : 'Done'}
                      </span>
                    )}
                    {u.status === 'error' && (
                      <span className="shrink-0 text-xs text-red-700">
                        {u.error || (isAr ? 'فشل' : 'Failed')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!hasAttachment || pending || submitting}
          className="bg-brand-teal hover:bg-brand-teal/90"
        >
          <Send className="h-4 w-4" />
          {submitting
            ? isAr
              ? 'جارٍ الإرسال…'
              : 'Submitting…'
            : t('submitToCommittee')}
        </Button>
      </div>
    </div>
  );
}
