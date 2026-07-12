'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  suggestLeastLoadedEvaluators,
  type EvaluatorSuggestion,
} from '@/app/[locale]/admin/assignments/actions';

// Auto-suggest hint (Missing 2.1). Renders a button that asks the server for
// the least-loaded evaluators and shows them as a non-binding hint above the
// assignment form. It never assigns anyone — the admin still chooses.
export function EvaluatorAutoSuggest({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const [suggestions, setSuggestions] = useState<EvaluatorSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await suggestLeastLoadedEvaluators();
      if (res.ok) {
        setSuggestions(res.suggestions);
      } else {
        setError(res.error);
        setSuggestions(null);
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-teal">
            {isAr ? 'اقتراح تلقائي للمُقيِّمين' : 'Evaluator auto-suggest'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isAr
              ? 'اقتراح غير مُلزم لأقل ثلاثة مُقيِّمين حملاً — القرار النهائي لك.'
              : 'A non-binding hint of the three least-loaded evaluators — the choice stays yours.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isAr ? 'اقتراح تلقائي' : 'Auto-suggest'}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600">
          {isAr ? 'تعذّر جلب الاقتراح.' : 'Could not load a suggestion.'}
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal-light/30 px-3 py-1 text-xs text-brand-teal"
            >
              <span className="font-semibold tabular-nums">{i + 1}</span>
              <span dir="ltr">{s.label}</span>
              <span className="rounded-full bg-white/70 px-1.5 py-0.5 tabular-nums text-muted-foreground">
                {isAr
                  ? `${s.openCount} مفتوحة`
                  : `${s.openCount} open`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {isAr ? 'لا يوجد مُقيِّمون متاحون.' : 'No evaluators available.'}
        </p>
      )}
    </div>
  );
}
