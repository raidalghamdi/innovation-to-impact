'use client';

// Client wrapper for the evaluator dashboard "recent activity" section.
// Kept as a Client Component so that Lucide icon components stay on the client
// side — Server Components cannot pass function references (like Lucide icons)
// to Client Components in Next.js 15.

import { CheckCircle2, ClipboardList } from 'lucide-react';

type ActivityItem = {
  id: string;
  title: string;
  when: string;
};

type Props = {
  heading: string;
  emptyTitle: string;
  emptyHint: string;
  submittedLabel: string;
  items: ActivityItem[];
};

export function EvaluatorRecentActivity({
  heading,
  emptyTitle,
  emptyHint,
  submittedLabel,
  items,
}: Props) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-[var(--ink)]">{heading}</h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-16 text-center">
          <ClipboardList className="h-12 w-12 text-[var(--ink-faint)]" strokeWidth={1.5} />
          <p className="mt-4 font-display text-lg font-bold text-[var(--ink)]">{emptyTitle}</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--ink-soft)]">{emptyHint}</p>
        </div>
      ) : (
        <ul className="ev-card divide-y divide-[var(--line)]">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                style={{ background: 'var(--sage-soft)', color: 'var(--sage)' }}
              >
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                {submittedLabel} — {a.title}
              </span>
              <span className="ev-num shrink-0 text-xs text-[var(--ink-faint)]">{a.when}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
