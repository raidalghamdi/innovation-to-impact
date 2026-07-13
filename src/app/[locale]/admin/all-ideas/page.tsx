import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { AllIdeasConsole } from '@/components/all-ideas-console';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { createClient } from '@/lib/supabase/server';

/**
 * /admin/all-ideas — R42-later Item 10.
 *
 * Every supervisor (and admin) sees EVERY idea across all tracks — there is no
 * per-supervisor assignment. The list supports a track-only filter plus text
 * search, shows the full idea preview, and exposes the supervisor's three
 * decision powers: approve / return / reject.
 */
export default async function AllIdeasPage({
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

  const IDEA_COLS_BASE =
    'id, code, title_ar, title_en, proposed_solution, strategic_theme_id, activity_id, participation_type, team_name, team_members, original_source_metadata, submitter_id, status, submitted_at, created_at, rejection_reason, rejection_reason_ar';

  // `returned_to_innovator` is owned by the innovator agent (R42-later Item 6);
  // retry without it if that migration has not landed yet.
  let ideaRows: any[] = [];
  if (supabase) {
    const rich = await supabase
      .from('ideas')
      .select(`${IDEA_COLS_BASE}, returned_to_innovator`)
      .neq('status', 'draft')
      .order('submitted_at', { ascending: false, nullsFirst: false });
    let data = rich.data as any[] | null;
    if (!data) {
      const basic = await supabase
        .from('ideas')
        .select(IDEA_COLS_BASE)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false, nullsFirst: false });
      data = basic.data as any[] | null;
    }
    ideaRows = data ?? [];
  }

  // Enrich with activity names + submitter profiles (single round-trip each).
  const activityIds = Array.from(
    new Set(ideaRows.map((i) => i.activity_id).filter(Boolean))
  ) as string[];
  const activityMap = new Map<string, { name_ar: string | null; name_en: string | null }>();
  if (supabase && activityIds.length) {
    const { data: acts } = await supabase
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
  if (supabase && submitterIds.length) {
    const { data: profs } = await supabase
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
      returned_to_innovator: i.returned_to_innovator ?? false,
      activity_name_ar: act?.name_ar ?? null,
      activity_name_en: act?.name_en ?? null,
      challenge,
      submitter_name: sub?.name ?? null,
      submitter_email: sub?.email ?? null,
    };
  });

  const { data: themesRaw } = supabase
    ? await supabase.from('strategic_themes').select('id, name_ar, name_en').order('name_en')
    : { data: [] as any[] };
  const themes = ((themesRaw as Array<{ id: string; name_ar: string | null; name_en: string | null }> | null) ?? []).map(
    (th) => ({ id: th.id, title_ar: th.name_ar, title_en: th.name_en })
  );

  const t = await getTranslations('supervisor');

  return (
    <AppShell>
      <PageHeader title={t('allIdeasTitle')} subtitle={t('allIdeasSubtitle')} />
      <AllIdeasConsole locale={locale} ideas={ideas as any[]} themes={themes} />
    </AppShell>
  );
}
