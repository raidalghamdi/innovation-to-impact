import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { PhasesEditor } from '@/components/phases-editor';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { loadPhaseSchedule } from '@/lib/phase-schedule';

export default async function AdminPhasesPage({
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

  const phases = await loadPhaseSchedule();

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'جدولة المراحل' : 'Phase scheduling'}
        subtitle={
          isAr
            ? 'حدّد تواريخ بدء ونهاية كلّ مرحلة من مراحل البرنامج السبع. سيتم استخدامها لعرض العدّ التنازلي وتفعيل/تعطيل التقديم.'
            : 'Set start and end dates for each of the 7 program phases. These drive countdowns and gate submission CTAs.'
        }
      />
      <div className="mt-6">
        <PhasesEditor locale={locale} initialPhases={phases} />
      </div>
    </AppShell>
  );
}
