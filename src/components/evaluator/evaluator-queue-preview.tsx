'use client';

// Landing-page preview of the evaluator's evaluation queue. Receives already
// serialized rows from the Server Component (no Lucide icon / component props
// crossing the boundary) and renders the first few ideas with an "evaluate"
// link plus a "view all" link to the full queue.

import { ClipboardList, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';

type QueueRow = {
  id: string;
  title: string;
  track: string | null;
  submitted: string;
};

type Props = {
  heading: string;
  viewAllLabel: string;
  evaluateLabel: string;
  emptyLabel: string;
  emptyCtaLabel: string;
  submittedOnLabel: string;
  items: QueueRow[];
};

export function EvaluatorQueuePreview({
  heading,
  viewAllLabel,
  evaluateLabel,
  emptyLabel,
  emptyCtaLabel,
  submittedOnLabel,
  items,
}: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">{heading}</h2>
        <Link
          href="/evaluator/ideas"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--gold-deep)]"
        >
          {viewAllLabel}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
          <ClipboardList className="h-10 w-10 text-[var(--ink-faint)]" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-[var(--ink-soft)]">{emptyLabel}</p>
          <Link
            href="/evaluator/ideas"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold-deep)] hover:underline"
          >
            {emptyCtaLabel}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      ) : (
        <ul className="ev-card divide-y divide-[var(--line)]">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{it.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--ink-faint)]">
                  {it.track && <span className="ev-badge-sage">{it.track}</span>}
                  <span className="ev-num">
                    {submittedOnLabel} {it.submitted}
                  </span>
                </p>
              </div>
              <Link
                href={`/evaluator/ideas/${it.id}` as any}
                className="ev-btn-gold shrink-0 text-sm"
              >
                {evaluateLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
