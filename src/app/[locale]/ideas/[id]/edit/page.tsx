import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { IdeaEditForm } from '@/components/idea-edit-form';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';

/**
 * /ideas/[id]/edit — Partial-edit page for a returned idea.
 *
 * Access rules:
 *   - Must be logged in.
 *   - Must be the idea's submitter.
 *   - Idea status must be 'returned' or 'draft'.
 *
 * Only sections listed in `editable_sections` (set by the supervisor when
 * returning the idea) are editable. Other sections render as read-only with
 * a lock icon. The resubmit API enforces the same gate on the server.
 */
export default async function IdeaEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  if (!supabase) redirect(`/${locale}/ideas/${id}`);

  const { data: idea } = await supabase
    .from('ideas')
    .select(
      'id, submitter_id, status, title_ar, title_en, proposed_solution, strategic_theme_id, activity_id, participation_type, team_name, team_members, original_source_metadata, editable_sections, rejection_reason, rejection_reason_ar'
    )
    .eq('id', id)
    .maybeSingle();

  if (!idea) notFound();

  const row = idea as any;
  if (row.submitter_id !== user.id) redirect(`/${locale}/ideas/${id}`);
  if (row.status !== 'returned' && row.status !== 'draft') {
    redirect(`/${locale}/ideas/${id}`);
  }

  const editableSections = Array.isArray(row.editable_sections)
    ? (row.editable_sections as string[])
    : [];
  const validSections = [
    'activity_id',
    'strategic_theme_id',
    'challenge',
    'participation_type',
    'team',
    'title',
    'proposed_solution',
    'attachments',
  ] as const;
  const cleaned = editableSections.filter((s) => (validSections as readonly string[]).includes(s)) as Array<
    (typeof validSections)[number]
  >;

  // Option lists for the activity / track selects.
  const { data: activitiesRaw } = await supabase
    .from('activities')
    .select('id, name_ar, name_en')
    .order('name_en');
  const activities = ((activitiesRaw as any[]) ?? []).map((a) => ({
    id: a.id,
    name_ar: a.name_ar ?? null,
    name_en: a.name_en ?? null,
  }));

  const { data: themesRaw } = await supabase
    .from('strategic_themes')
    .select('id, name_ar, name_en')
    .order('name_en');
  const themes = ((themesRaw as any[]) ?? []).map((th) => ({
    id: th.id,
    name_ar: th.name_ar ?? null,
    name_en: th.name_en ?? null,
  }));

  const meta = row.original_source_metadata;
  const challenge =
    meta && typeof meta === 'object' && meta.challenge ? String(meta.challenge) : '';
  const teamMembers = Array.isArray(row.team_members)
    ? (row.team_members as Array<{ name?: string | null; email?: string | null }>).map((m) => ({
        name: m?.name ?? '',
        email: m?.email ?? '',
      }))
    : [];

  const reason =
    locale === 'ar'
      ? row.rejection_reason_ar || row.rejection_reason || null
      : row.rejection_reason || row.rejection_reason_ar || null;

  return (
    <AppShell>
      <PageHeader
        title={locale === 'ar' ? 'تعديل الفكرة' : 'Edit idea'}
        subtitle={
          locale === 'ar'
            ? 'قم بتعديل الأقسام التي حددها المشرف ثم أعد إرسال الفكرة.'
            : 'Update the sections the supervisor selected, then resubmit.'
        }
      />
      <IdeaEditForm
        locale={locale}
        ideaId={id}
        initial={{
          title_ar: row.title_ar,
          title_en: row.title_en,
          proposed_solution: row.proposed_solution,
          activity_id: row.activity_id ?? null,
          strategic_theme_id: row.strategic_theme_id ?? null,
          challenge,
          participation_type:
            row.participation_type === 'team' ? 'team' : 'individual',
          team_name: row.team_name ?? null,
          team_members: teamMembers,
        }}
        activities={activities}
        themes={themes}
        editableSections={cleaned}
        reason={reason}
      />
    </AppShell>
  );
}
