import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

/**
 * View-only 3-step post-program indicator: Pilot → Measurement → Scaling.
 * Rendered on the idea details page for the owner once an idea is approved and
 * moving through the post-program lifecycle. Highlights the current stage and
 * marks earlier stages complete. Purely informational — no controls.
 */
const STAGE_ORDER = ['in_pilot', 'in_measurement', 'in_scaling'] as const;

export async function PostProgramStages({
  status,
  locale,
}: {
  status: string;
  locale: string;
}) {
  const t = await getTranslations('innovator.postProgram');

  // 'approved' precedes the first tracked stage — nothing highlighted yet.
  const currentIndex = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);

  const steps = [
    { key: 'pilot', label: t('pilot') },
    { key: 'measurement', label: t('measurement') },
    { key: 'scaling', label: t('scaling') },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-brand-teal">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
          {steps.map((step, i) => {
            const isDone = currentIndex > i;
            const isCurrent = currentIndex === i;
            return (
              <li
                key={step.key}
                className="flex flex-1 items-center gap-3 sm:flex-col sm:gap-2 sm:text-center"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                    isDone
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : isCurrent
                        ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                        : 'border-border bg-muted text-muted-foreground'
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-brand-teal' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
