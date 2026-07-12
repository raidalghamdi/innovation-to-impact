import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { fetchComplianceControls } from '@/lib/data';

// /admin/compliance — Standards & Compliance controls (Missing 1.5).
// Read-only server component listing innovation.compliance_controls so admins
// can see, at a glance, which regulatory controls (DGA/NCA/SDAIA/WCAG/…) the
// platform maps to and their current status + the feature/entity they link to.

const STATUS_STYLE: Record<string, string> = {
  met: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-amber-100 text-amber-700',
  not_started: 'bg-slate-100 text-slate-600',
  not_applicable: 'bg-slate-100 text-slate-500',
};

function statusLabel(status: string, isAr: boolean): string {
  const map: Record<string, [string, string]> = {
    met: ['مستوفى', 'Met'],
    in_progress: ['قيد التنفيذ', 'In progress'],
    not_started: ['لم يبدأ', 'Not started'],
    not_applicable: ['غير منطبق', 'Not applicable'],
  };
  const pair = map[status];
  if (!pair) return status;
  return isAr ? pair[0] : pair[1];
}

export default async function AdminCompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const controls = await fetchComplianceControls();

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'المعايير والامتثال' : 'Standards & Compliance'}
        subtitle={
          isAr
            ? 'ضوابط الامتثال التنظيمية (DGA / NCA / SDAIA / WCAG) وحالتها والميزة المرتبطة بها.'
            : 'Regulatory compliance controls (DGA / NCA / SDAIA / WCAG), their status, and the linked feature.'
        }
      />

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {controls.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {isAr ? 'لا توجد ضوابط مسجّلة.' : 'No controls recorded.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'رمز الضابط' : 'Control code'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'المعيار' : 'Standard'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'المتطلب' : 'Requirement'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'الحالة' : 'Status'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'الجهة/الميزة المرتبطة' : 'Linked entity'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {controls.map((c) => {
                    const requirement = isAr
                      ? c.title_ar || c.title_en
                      : c.title_en || c.title_ar;
                    const linked = (c.mapped_feature_paths ?? []).filter(Boolean);
                    return (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="p-3 font-mono text-xs text-foreground" dir="ltr">
                          {c.control_code}
                        </td>
                        <td className="p-3 font-medium text-brand-teal" dir="ltr">
                          {c.standard_body}
                        </td>
                        <td className="p-3 text-foreground">{requirement}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_STYLE[c.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {statusLabel(c.status, isAr)}
                          </span>
                        </td>
                        <td className="p-3">
                          {linked.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {linked.map((p) => (
                                <code
                                  key={p}
                                  className="w-fit rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                  dir="ltr"
                                >
                                  {p}
                                </code>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
