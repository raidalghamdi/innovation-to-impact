import { Link } from '@/i18n/routing';
import { getQuickActions } from '@/lib/quick-actions';
import type { Role } from '@/lib/roles';

// Role-aware quick actions grid, ported from the GAC hackathon prototype.
// Rendered on the dashboard as the primary personalized entry point.
export function QuickActions({
  role,
  locale,
  title,
}: {
  role: Role;
  locale: string;
  title: string;
}) {
  const isAr = locale === 'ar';
  const actions = getQuickActions(role);

  return (
    <section className="mt-8" data-widget="quick_actions">
      <h2 className="mb-4 text-xl font-bold text-brand-teal">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map((a) => (
          <Link
            key={a.id}
            href={a.href as any}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-md"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {a.icon}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {isAr ? a.labelAr : a.labelEn}
            </span>
            <span className="text-xs text-muted-foreground">
              {isAr ? a.subAr : a.subEn}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
