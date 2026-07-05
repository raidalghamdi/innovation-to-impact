'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { signIpTerms } from './actions';

export function SignIpTermsButton({
  ideaId,
  alreadySigned,
  signButtonLabel,
  signedConfirmLabel,
  alreadySignedLabel,
}: {
  ideaId: string;
  alreadySigned: boolean;
  signButtonLabel: string;
  signedConfirmLabel: string;
  alreadySignedLabel: string;
}) {
  const [signed, setSigned] = useState(alreadySigned);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (signed) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-brand-teal/10 px-4 py-2.5 text-sm font-medium text-brand-teal">
        <CheckCircle2 className="h-4 w-4" />
        {alreadySigned ? alreadySignedLabel : signedConfirmLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await signIpTerms(ideaId);
            if (res.ok) {
              setSigned(true);
            } else {
              setError(res.error ?? 'error');
            }
          })
        }
      >
        {signButtonLabel}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
