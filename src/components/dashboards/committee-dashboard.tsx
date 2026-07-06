import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { Gavel, CalendarCheck2, ArrowRight, ArrowLeft } from 'lucide-react';

// src/components/dashboards/committee-dashboard.tsx:1
// Phase 12.2 — KPIs: ideas awaiting decision, decisions this week.
export async function CommitteeDashboard({ locale }: { locale: string }) {
  const isAr = locale === 'ar';
  const Chevron = isAr ? ArrowLeft : ArrowRight;

  let awaitingDecision = 0;
  let decisionsThisWeek = 0;

  const admin = createAdminClient();
  if (admin) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: awaitingCount }, { count: weekCount }] = await Promise.all([
      admin.from('ideas').select('id', { count: 'exact', head: true }).eq('status', 'committee'),
      admin
        .from('committee_decisions')
        .select('id', { count: 'exact', head: true })
        .gte('decided_at', weekAgo),
    ]);
    awaitingDecision = awaitingCount ?? 0;
    decisionsThisWeek = weekCount ?? 0;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label={isAr ? 'أفكار بانتظار القرار' : 'Ideas Awaiting Decision'} value={awaitingDecision} icon={Gavel} />
        <KpiCard label={isAr ? 'قرارات هذا الأسبوع' : 'Decisions This Week'} value={decisionsThisWeek} icon={CalendarCheck2} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          {isAr ? 'راجع الأفكار المحالة إلى اللجنة' : 'Review ideas referred to committee'}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/committee">
            {isAr ? 'الذهاب إلى اللجنة' : 'Go to Committee'}
            <Chevron className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
