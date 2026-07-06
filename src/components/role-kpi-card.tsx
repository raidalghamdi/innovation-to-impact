import type { LucideIcon } from 'lucide-react';

// src/components/role-kpi-card.tsx:1
// Phase 12.2 — shared, lightweight KPI card for the 5 new role-based
// dashboards. Named distinctly from the pre-existing `KPICard` in
// `@/components/kpi-card` (registry-driven, used by /analytics and
// /activities pages) to avoid colliding with or replacing that component —
// per the standing rule to never remove existing functionality.
export function RoleKpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
