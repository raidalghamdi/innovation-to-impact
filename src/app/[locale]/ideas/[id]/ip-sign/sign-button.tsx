'use client';

import { useState, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'ar';
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Already signed on a prior visit — offer a link forward to the
  // confirmation. Use a full-URL push so middleware sees fresh cookies.
  if (alreadySigned) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 rounded-md bg-brand-teal/10 px-4 py-2.5 text-sm font-medium text-brand-teal">
          <CheckCircle2 className="h-4 w-4" />
          {alreadySignedLabel}
        </div>
        <Button
          size="lg"
          onClick={() => router.push(`/${locale}/ideas/${ideaId}/submitted`)}
        >
          {signedConfirmLabel}
        </Button>
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
            if (!res.ok) {
              setError(res.error ?? 'error');
              return;
            }
            // Hard navigation ensures middleware sees the freshest
            // Supabase auth cookies after the server action wrote them
            // — avoids the middleware occasionally bouncing us to /login
            // right after signing (see the idea-form.tsx comment for why
            // client-side router.push is unsafe post-mutation).
            window.location.assign(`/${locale}/ideas/${ideaId}/submitted`);
          })
        }
      >
        {signButtonLabel}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
