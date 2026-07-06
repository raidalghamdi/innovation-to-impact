import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { Users2, Lightbulb, ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';

// src/components/dashboards/supervisor-dashboard.tsx:1
// Phase 12.2 — KPIs: team members, ideas from my sector, escalations awaiting
// me. "My sector" is approximated by the supervisor's own department (best
// available signal — a dedicated sector/department assignment for supervisors
// is out of scope for this batch; see final report deferred items).
export async function SupervisorDashboard({ userId, locale }: { userId: string; locale: string }) {
  const isAr = locale === 'ar';
  const Chevron = isAr ? ArrowLeft : ArrowRight;

  let teamMembers = 0;
  let sectorIdeas = 0;
  let escalationsAwaiting = 0;

  const admin = createAdminClient();
  if (admin) {
    const { data: me } = await admin.from('user_profiles').select('department').eq('id', userId).maybeSingle();
    const department = me?.department ?? null;

    const [{ count: teamCount }, { count: escCount }] = await Promise.all([
      department
        ? admin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('department', department)
        : Promise.resolve({ count: 0 } as any),
      admin
        .from('escalations')
        .select('id', { count: 'exact', head: true })
        .eq('current_owner_id', userId)
        .eq('status', 'open'),
    ]);
    teamMembers = teamCount ?? 0;
    escalationsAwaiting = escCount ?? 0;

    if (department) {
      const { count: ideaCount } = await admin
        .from('ideas')
        .select('id, user_profiles!inner(department)', { count: 'exact', head: true })
        .eq('user_profiles.department', department);
      sectorIdeas = ideaCount ?? 0;
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={isAr ? 'أعضاء الفريق' : 'Team Members'} value={teamMembers} icon={Users2} />
        <KpiCard label={isAr ? 'أفكار من قطاعي' : 'Ideas From My Sector'} value={sectorIdeas} icon={Lightbulb} />
        <KpiCard label={isAr ? 'تصعيدات بانتظاري' : 'Escalations Awaiting Me'} value={escalationsAwaiting} icon={ShieldAlert} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          {isAr ? 'اطّلع على تصعيدات فريقك وقطاعك' : 'Review your team and sector escalations'}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/admin/escalations">
            {isAr ? 'الذهاب إلى التصعيدات' : 'Go to Escalations'}
            <Chevron className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
