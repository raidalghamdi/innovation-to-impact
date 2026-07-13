import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { EvaluatorTrackAssignments } from '@/components/supervisor/evaluator-track-assignments';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { fetchEvaluatorOptions } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';

// /admin/evaluator-assignments (R43) — admin OR supervisor bind evaluators to
// tracks (strategic themes). Ideas are auto-distributed to every evaluator of
// their track (no per-idea manual assignment).
export default async function EvaluatorAssignmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const isSupervisor = await userHasRole(user.id, 'supervisor');
  const allowed = isSupervisor || user.role === 'admin';
  if (!allowed) redirect(`/${locale}/dashboard`);

  const supabase = await createClient();

  const evaluators = await fetchEvaluatorOptions();

  const { data: themesRaw } = supabase
    ? await supabase
        .from('strategic_themes')
        .select('id, name_ar, name_en')
        .order('name_en')
    : { data: [] as Array<{ id: string; name_ar: string | null; name_en: string | null }> };
  const tracks = (
    (themesRaw as Array<{ id: string; name_ar: string | null; name_en: string | null }> | null) ??
    []
  ).map((th) => ({
    id: th.id,
    name: locale === 'ar' ? th.name_ar || th.name_en || th.id : th.name_en || th.name_ar || th.id,
  }));

  const { data: rows } = supabase
    ? await supabase.from('evaluator_track_assignments').select('evaluator_id, track_id')
    : { data: [] as Array<{ evaluator_id: string; track_id: string }> };
  const initialAssignments = (
    (rows as Array<{ evaluator_id: string; track_id: string }> | null) ?? []
  ).map((r) => `${r.evaluator_id}::${r.track_id}`);

  const t = await getTranslations('admin.assignmentsTracks');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EvaluatorTrackAssignments
        evaluators={evaluators}
        tracks={tracks}
        initialAssignments={initialAssignments}
      />
    </AppShell>
  );
}
