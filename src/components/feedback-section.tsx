// Reviewer feedback \u2014 shown to submitters on the idea detail page.
// Preserves reviewer anonymity: shows role (Evaluator / Judge), never name.
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { ReviewerFeedback } from '@/lib/feedback';
import { MessageSquare, Star, Scale, ShieldCheck } from 'lucide-react';

export async function FeedbackSection({
  feedback,
  locale,
  highlight = false,
}: {
  feedback: ReviewerFeedback[];
  locale: string;
  // When true (idea returned for revision) the card is emphasised with an
  // amber/yellow surface so the innovator immediately sees the reviewer notes
  // they must act on.
  highlight?: boolean;
}) {
  // Hide the card entirely when there are no reviewer comments to show — the
  // section is only meant to surface real notes (e.g. when an idea is returned
  // for edits), never an empty placeholder.
  if (feedback.length === 0) return null;

  const t = await getTranslations('feedback');
  return (
    <Card className={highlight ? 'border-amber-400 bg-amber-50' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-brand-teal">
          <MessageSquare className="h-4 w-4 text-brand-teal" />
          <span>{t('title')}</span>
          <span className="ms-1 inline-flex items-center justify-center rounded-full bg-brand-teal-light px-2 py-0.5 text-[11px] font-semibold text-brand-teal">
            {feedback.length}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {feedback.map((f) => (
            <FeedbackCard
              key={f.id}
              feedback={f}
              locale={locale}
              roleLabel={
                f.reviewer_role === 'judge' ? t('roleJudge') : t('roleEvaluator')
              }
              ratingLabel={t('ratingLabel')}
              recommendationLabel={t('recommendationLabel')}
            />
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          {t('anonymityNote')}
        </p>
      </CardContent>
    </Card>
  );
}

function FeedbackCard({
  feedback,
  locale,
  roleLabel,
  ratingLabel,
  recommendationLabel,
}: {
  feedback: ReviewerFeedback;
  locale: string;
  roleLabel: string;
  ratingLabel: string;
  recommendationLabel: string;
}) {
  const RoleIcon = feedback.reviewer_role === 'judge' ? Scale : ShieldCheck;
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-light/60 px-2.5 py-1 text-[11px] font-semibold text-brand-teal">
          <RoleIcon className="h-3.5 w-3.5" />
          {roleLabel}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatDate(feedback.date, locale)}
        </span>
      </div>
      {feedback.rating != null && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{ratingLabel}:</span>
          <StarRating value={feedback.rating} />
          <span className="text-[11px] font-medium text-brand-teal">
            {feedback.rating.toFixed(1)} / 5
          </span>
        </div>
      )}
      {feedback.recommendation && (
        <p className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{recommendationLabel}:</span>{' '}
          {feedback.recommendation}
        </p>
      )}
      {feedback.comments && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {feedback.comments}
        </p>
      )}
    </li>
  );
}

function StarRating({ value }: { value: number }) {
  // 5 stars, filled proportionally to `value` (0..5)
  const pct = Math.max(0, Math.min(5, value)) / 5;
  return (
    <span
      className="relative inline-block text-brand-gold"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      <span className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-3.5 w-3.5" strokeWidth={1.5} />
        ))}
      </span>
      <span
        className="pointer-events-none absolute inset-y-0 start-0 overflow-hidden"
        style={{ width: `${pct * 100}%` }}
        aria-hidden="true"
      >
        <span className="flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-brand-gold" strokeWidth={1.5} />
          ))}
        </span>
      </span>
    </span>
  );
}

// Compact badge shown on the /my-ideas list. Renders nothing when count = 0.
export function FeedbackCountBadge({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-brand-teal/30 bg-brand-teal-light/70 px-2 py-0.5 text-[11px] font-semibold text-brand-teal"
      title={label}
    >
      <MessageSquare className="h-3 w-3" />
      {count} {label}
    </span>
  );
}
