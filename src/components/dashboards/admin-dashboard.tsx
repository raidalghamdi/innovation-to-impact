import { Link } from '@/i18n/routing';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { Users, Lightbulb, ClipboardList, HeartPulse, UserCog, Shapes, Upload, SlidersHorizontal } from 'lucide-react';

// src/components/dashboards/admin-dashboard.tsx:1
// Phase 12.2 — KPIs: total users, active ideas, pending evaluations, system
// health (simple heuristic: all core tables reachable = healthy).
export async function AdminDashboard({ locale }: { locale: string }) {
  const isAr = locale === 'ar';

  let totalUsers = 0;
  let activeIdeas = 0;
  let pendingEvaluations = 0;
  let healthy = true;

  const admin = createAdminClient();
  if (admin) {
    const [{ count: userCount, error: e1 }, { count: ideaCount, error: e2 }, { count: pendingCount, error: e3 }] =
      await Promise.all([
        admin.from('user_profiles').select('id', { count: 'exact', head: true }),
        admin
          .from('ideas')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '(closed,archived,withdrawn,rejected)'),
        admin.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
    totalUsers = userCount ?? 0;
    activeIdeas = ideaCount ?? 0;
    pendingEvaluations = pendingCount ?? 0;
    healthy = !e1 && !e2 && !e3;
  } else {
    healthy = false;
  }

  const shortcuts = [
    { href: '/admin/users', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: UserCog },
    { href: '/admin/roles', labelAr: 'كتالوج الأدوار', labelEn: 'Roles Catalog', icon: Shapes },
    { href: '/admin/employees/import', labelAr: 'استيراد الموظفين', labelEn: 'Employees Import', icon: Upload },
    { href: '/admin/settings', labelAr: 'إعدادات المنصة', labelEn: 'Platform Settings', icon: SlidersHorizontal },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={isAr ? 'إجمالي المستخدمين' : 'Total Users'} value={totalUsers} icon={Users} />
        <KpiCard label={isAr ? 'أفكار نشطة' : 'Active Ideas'} value={activeIdeas} icon={Lightbulb} />
        <KpiCard label={isAr ? 'تقييمات معلّقة' : 'Pending Evaluations'} value={pendingEvaluations} icon={ClipboardList} />
        <KpiCard
          label={isAr ? 'سلامة النظام' : 'System Health'}
          value={healthy ? (isAr ? 'جيدة' : 'Healthy') : isAr ? 'تحذير' : 'Warning'}
          icon={HeartPulse}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-teal">{isAr ? 'اختصارات الإدارة' : 'Admin Shortcuts'}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href as any}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground">{isAr ? s.labelAr : s.labelEn}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
