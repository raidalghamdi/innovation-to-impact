'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markSupportHandled } from '@/app/[locale]/admin/support/actions';

// Client button that flips a support message to "handled". The server action
// stamps handled_at/handled_by and revalidates the page.
export function SupportHandledButton({ id, locale }: { id: string; locale: string }) {
  const isAr = locale === 'ar';
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(false);
    startTransition(async () => {
      const res = await markSupportHandled(id);
      if (!res.ok) setError(true);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {isAr ? 'وضع علامة كمُعالَج' : 'Mark handled'}
      </Button>
      {error && (
        <span className="text-xs text-red-600">
          {isAr ? 'تعذّر التحديث.' : 'Could not update.'}
        </span>
      )}
    </div>
  );
}
