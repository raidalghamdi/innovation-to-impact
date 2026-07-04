'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { withdrawIdea } from '@/app/[locale]/my-ideas/actions';
import { X } from 'lucide-react';

/**
 * Withdraw button + inline confirm. Renders only when the caller has already
 * verified the idea is withdrawable (submitter + stage ≤ 2 + not already
 * withdrawn). We still call the server action to enforce the same checks
 * server-side — the client guard is purely for hiding an unusable control.
 */
export function WithdrawIdeaButton({ ideaId }: { ideaId: string }) {
  const t = useTranslations('ideas');
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await withdrawIdea(ideaId);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <X className="h-3.5 w-3.5" />
        {t('withdraw')}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t('withdrawConfirm')}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        {t('withdrawCancel')}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleConfirm}
        disabled={pending}
        className="bg-red-600 text-white hover:bg-red-700"
      >
        {pending ? t('withdrawing') : t('withdrawYes')}
      </Button>
      {error && <span className="text-xs text-red-700">{t('withdrawError')}</span>}
    </div>
  );
}
