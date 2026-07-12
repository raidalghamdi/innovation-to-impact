import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { PhasesEditor } from '@/components/phases-editor';
import { TracksManager, type Track } from '@/components/tracks-manager';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { loadPhaseSchedule } from '@/lib/phase-schedule';
import { createClient } from '@/lib/supabase/server';

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

  const supabase = await createClient();
  const { data: trackRows } = supabase
    ? await supabase
        .from('strategic_themes')
        .select('id, name_ar, name_en, description_ar, description_en')
        .order('name_en')
    : { data: [] as Track[] };

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
      <TracksManager locale={locale} initialTracks={(trackRows as Track[]) ?? []} />
    </AppShell>
  );
}
