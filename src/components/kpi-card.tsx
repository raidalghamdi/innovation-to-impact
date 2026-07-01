import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import { ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'teal',
  href,
  hrefLabel,
  locale,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'teal' | 'gold';
  href?: string;
  hrefLabel?: string;
  locale?: string;
}) {
  const Arrow = locale === 'ar' ? ArrowUpLeft : ArrowUpRight;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
              accent === 'teal'
                ? 'bg-brand-teal-light text-brand-teal'
                : 'bg-brand-gold-light text-brand-gold'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {href && hrefLabel && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-teal">
          {hrefLabel}
          <Arrow className="h-3 w-3" />
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        <Card className="p-5 transition-shadow hover:shadow-md hover:border-brand-teal/40">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card className="p-5">{inner}</Card>;
}
