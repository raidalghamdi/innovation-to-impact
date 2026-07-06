import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClipboardList, CheckCircle2, Gauge, ArrowRight, ArrowLeft } from 'lucide-react';

// src/components/dashboards/judge-dashboard.tsx:1
// Phase 12.2 — KPIs: pending evaluations, completed, average score given.
export async function JudgeDashboard({ userId, locale }: { userId: string; locale: string }) {
  const t = await getTranslations('dashboard');
  const isAr = locale === 'ar';
  const Chevron = isAr ? ArrowLeft : ArrowRight;

  let pending = 0;
  let completed = 0;
  let avgScore: string = '—';

  const admin = createAdminClient();
  if (admin) {
    const [{ count: pendingCount }, { data: myEvals }] = await Promise.all([
      admin
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('evaluator_id', userId)
        .eq('status', 'pending'),
      admin.from('evaluations').select('total_score').eq('evaluator_id', userId),
    ]);
    pending = pendingCount ?? 0;
    completed = myEvals?.length ?? 0;
    if (myEvals && myEvals.length > 0) {
      const scores = myEvals.map((e: any) => Number(e.total_score)).filter((n: number) => !Number.isNaN(n));
      if (scores.length > 0) {
        avgScore = (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={isAr ? 'تقييمات معلّقة' : 'Pending Evaluations'} value={pending} icon={ClipboardList} />
        <KpiCard label={isAr ? 'مكتملة' : 'Completed'} value={completed} icon={CheckCircle2} />
        <KpiCard label={isAr ? 'متوسط الدرجات الممنوحة' : 'Average Score Given'} value={avgScore} icon={Gauge} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          {isAr ? 'لديك أفكار بانتظار تقييمك' : 'You have ideas awaiting your evaluation'}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/evaluation">
            {isAr ? 'الذهاب إلى قائمة التقييم' : 'Go to Evaluation Queue'}
            <Chevron className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
