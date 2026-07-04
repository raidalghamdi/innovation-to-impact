import { useTranslations } from 'next-intl';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pioneer badge — shown when a submitter's idea has reached Stage 6 (Pilot) or beyond.
 * Uses brand gold to make it stand out from the neutral status badges.
 */
export function PioneerBadge({ className }: { className?: string }) {
  const t = useTranslations('recognition');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-brand-gold/40 bg-brand-gold-light/70 px-2.5 py-0.5 text-[11px] font-semibold text-brand-teal',
        className
      )}
      title={t('pioneerTooltip')}
    >
      <Award className="h-3.5 w-3.5 text-brand-gold" />
      <span>{t('pioneer')}</span>
    </span>
  );
}

/** Threshold at which a submitter earns Pioneer recognition. Stage 6 = Pilot. */
export const PIONEER_STAGE_THRESHOLD = 6;

export function isPioneerIdea(stage: number): boolean {
  return stage >= PIONEER_STAGE_THRESHOLD;
}
