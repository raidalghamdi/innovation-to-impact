import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Shared empty-state block. Renders inside a Card by default for consistent
 * page rhythm. Set `bare` to render without the card wrapper (useful when the
 * parent already provides one).
 *
 * Bilingual by construction: text comes from the caller (already localized),
 * the icon chip uses no directional utilities, and the optional CTA arrow
 * flips via `rtl:rotate-180` so it points the right way in Arabic.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  bare = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  bare?: boolean;
  className?: string;
}) {
  const body = (
    <div className={cn('flex flex-col items-center gap-3 py-12 text-center', className)}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-light"
        aria-hidden="true"
      >
        <Icon className="h-8 w-8 text-brand-teal" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {cta && (
        <Button asChild className="mt-2">
          <Link href={cta.href as any}>
            {cta.label}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      )}
    </div>
  );

  if (bare) return body;
  return (
    <Card>
      <CardContent className="p-6">{body}</CardContent>
    </Card>
  );
}
