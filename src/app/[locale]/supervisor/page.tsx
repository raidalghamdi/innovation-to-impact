import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { SupervisorDashboard } from '@/components/supervisor-dashboard';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Pull ideas needing supervisor attention (draft is excluded — those are still with innovator).
  // `returned_to_innovator` is added by the innovator agent (R42-later Item 6); if that migration
  // has not landed yet we retry without the column so the dashboard still renders.
  const IDEA_COLS_BASE =
    'id, code, title_ar, title_en, proposed_solution, strategic_theme_id, activity_id, participation_type, team_name, team_members, original_source_metadata, submitter_id, status, submitted_at, created_at, rejection_reason, rejection_reason_ar';
  const IDEA_STATUSES = ['submitted', 'screening', 'returned', 'approved', 'assigned', 'evaluation', 'committee', 'rejected'];
  const ideasRich = await supabase!
    .from('ideas')
    .select(`${IDEA_COLS_BASE}, returned_to_innovator`)
    .in('status', IDEA_STATUSES)
    .order('submitted_at', { ascending: false, nullsFirst: false });
  let ideasRaw = ideasRich.data as any[] | null;
  if (!ideasRaw) {
    const ideasBasic = await supabase!
      .from('ideas')
      .select(IDEA_COLS_BASE)
      .in('status', IDEA_STATUSES)
      .order('submitted_at', { ascending: false, nullsFirst: false });
    ideasRaw = ideasBasic.data as any[] | null;
  }

  const ideaRows = (ideasRaw as any[]) ?? [];

  // Resolve activity (الفعالية) names and submitter (مقدّم الفكرة) profiles so the
  // review modal can render them without extra round-trips.
  const activityIds = Array.from(
    new Set(ideaRows.map((i) => i.activity_id).filter(Boolean))
  ) as string[];
  const activityMap = new Map<string, { name_ar: string | null; name_en: string | null }>();
  if (activityIds.length) {
    const { data: acts } = await supabase!
      .from('activities')
      .select('id, name_ar, name_en')
      .in('id', activityIds);
    for (const a of (acts as any[]) ?? [])
      activityMap.set(a.id, { name_ar: a.name_ar ?? null, name_en: a.name_en ?? null });
  }

  const submitterIds = Array.from(
    new Set(ideaRows.map((i) => i.submitter_id).filter(Boolean))
  ) as string[];
  const submitterMap = new Map<string, { name: string | null; email: string | null }>();
  if (submitterIds.length) {
    const { data: profs } = await supabase!
      .from('user_profiles')
      .select('id, full_name, full_name_ar, email')
      .in('id', submitterIds);
    for (const p of (profs as any[]) ?? [])
      submitterMap.set(p.id, {
        name: locale === 'ar' ? p.full_name_ar || p.full_name : p.full_name || p.full_name_ar,
        email: p.email ?? null,
      });
  }

  const ideas = ideaRows.map((i) => {
    const act = i.activity_id ? activityMap.get(i.activity_id) : null;
    const sub = i.submitter_id ? submitterMap.get(i.submitter_id) : null;
    const meta = i.original_source_metadata;
    const challenge =
      meta && typeof meta === 'object' && meta.challenge ? String(meta.challenge) : null;
    return {
      ...i,
      activity_name_ar: act?.name_ar ?? null,
      activity_name_en: act?.name_en ?? null,
      challenge,
      submitter_name: sub?.name ?? null,
      submitter_email: sub?.email ?? null,
    };
  });

  // Themes / tracks — DB uses name_ar/name_en, alias to title_* for the client.
  const { data: themesRaw } = await supabase!
    .from('strategic_themes')
    .select('id, name_ar, name_en')
    .order('name_en');
  const themes = ((themesRaw as Array<{ id: string; name_ar: string | null; name_en: string | null }> | null) ?? []).map(
    (th) => ({ id: th.id, title_ar: th.name_ar, title_en: th.name_en })
  );

  // Available evaluators (users with evaluator OR judge role). Read from the
  // role source of truth via innovation.v_user_roles — reading user_roles
  // directly under the supervisor's RLS returns only their own rows, which is
  // why this dropdown previously showed "لا يوجد مقيّمون".
  const { data: evalRoleRows } = await supabase!
    .from('v_user_roles')
    .select('user_id')
    .in('role_code', ['evaluator', 'judge'])
    .eq('role_active', true);
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
        ideas={ideas as any[]}
        themes={themes}
        evaluators={evaluators}
        trackAssignments={(trackAssignments as any[]) ?? []}
      />
    </AppShell>
  );
}
