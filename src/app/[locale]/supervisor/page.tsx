import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { SupervisorDashboard } from '@/components/supervisor-dashboard';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { createClient } from '@/lib/supabase/server';

/**
 * /supervisor — screening + track-assignment console.
 *
 * The supervisor:
 *  - reviews newly submitted / screening ideas
 *  - approves, rejects, or returns to the innovator (with reason)
 *  - assigns evaluators to strategic tracks (not to individual ideas)
 *
 * Access is granted to any user with the `supervisor` role OR any admin.
 */
export default async function SupervisorPage({
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

  // Pull ideas needing supervisor attention (draft is excluded — those are still with innovator)
  const { data: ideas } = await supabase!
    .from('ideas')
    .select(
      'id, code, title_ar, title_en, problem_statement, proposed_solution, expected_benefits, strategic_theme_id, status, submitted_at, created_at, rejection_reason, rejection_reason_ar'
    )
    .in('status', ['submitted', 'screening', 'returned', 'approved', 'assigned', 'evaluation', 'rejected'])
    .order('submitted_at', { ascending: false, nullsFirst: false });

  // Themes / tracks — DB uses name_ar/name_en, alias to title_* for the client.
  const { data: themesRaw } = await supabase!
    .from('strategic_themes')
    .select('id, name_ar, name_en')
    .order('name_en');
  const themes = ((themesRaw as Array<{ id: string; name_ar: string | null; name_en: string | null }> | null) ?? []).map(
    (th) => ({ id: th.id, title_ar: th.name_ar, title_en: th.name_en })
  );

  // Available evaluators (users with evaluator OR judge role)
  const { data: evalRoleRows } = await supabase!
    .from('user_roles')
    .select('user_id, roles!inner(code)')
    .in('roles.code', ['evaluator', 'judge']);
  const evaluatorIds = Array.from(
    new Set((evalRoleRows as Array<{ user_id: string }> | null | undefined)?.map((r) => r.user_id) ?? [])
  );

  const evaluators: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (evaluatorIds.length) {
    const { data: profs } = await supabase!
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', evaluatorIds);
    for (const p of (profs as Array<{ id: string; full_name: string | null; email: string | null }> | null | undefined) ?? []) {
      evaluators.push(p);
    }
  }

  // Existing track assignments
  const { data: trackAssignments } = await supabase!
    .from('track_assignments')
    .select('id, theme_id, evaluator_id, status, assigned_at, notes')
    .eq('status', 'active');

  const t = await getTranslations('supervisor');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SupervisorDashboard
        locale={locale}
        ideas={(ideas as any[]) ?? []}
        themes={themes}
        evaluators={evaluators}
        trackAssignments={(trackAssignments as any[]) ?? []}
      />
    </AppShell>
  );
}
