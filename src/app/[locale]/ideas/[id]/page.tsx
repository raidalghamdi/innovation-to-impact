import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchIdeas } from '@/lib/data';
import { ideas as demoIdeas } from '@/lib/demo-data';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Download } from 'lucide-react';
import { getFeedbackForIdea } from '@/lib/feedback';
import { FeedbackSection } from '@/components/feedback-section';
import { IdeaHero } from '@/components/idea-hero';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';

/**
 * /ideas/[id] — Idea details page.
 *
 * Layout (matches design reference):
 *   1. Dark Hero with title, chips, team strip, export actions, 9-stage
 *      horizontal timeline, and (when returned) a banner + Edit CTA.
 *   2. Two-column body: main content (idea description + attachments) + side
 *      rail (team members, submission metadata, evaluator feedback).
 *
 * Team information now lives INSIDE this page (per user clarification —
 * previously in the my-ideas list card, moved here to declutter).
 */
export default async function IdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { locale, id } = await params;
  const { submitted } = await searchParams;
  const justSubmitted = submitted === '1';
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const tc = await getTranslations('common');

  const allIdeas = await fetchIdeas();
  const idea = allIdeas.find((i) => i.id === id) ?? demoIdeas.find((i) => i.id === id);
  if (!idea) notFound();

  const feedback = await getFeedbackForIdea(idea.id);

  // ─── Extra data for the redesigned page ────────────────────────────────
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  // Track / challenge names
  let themeName: string | null = null;
  let challengeName: string | null = null;
  let teamName: string | null = null;
  let teamMembers: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role_title: string | null;
    is_leader: boolean;
  }> = [];
  let attachments: Array<{ name: string; type: string; size?: number; url?: string }> = [];
  let submittedAt: string | null = null;
  let updatedAt: string | null = null;
  let currentStage = 0;
  let statusStr = 'draft';
  let ideaTitle = '';
  let ideaCode: string | null = null;
  let submitterId: string | null = null;

  if (supabase) {
    const { data: ideaRow } = await supabase
      .from('ideas')
      .select(
        'id, code, title_ar, title_en, status, current_stage, strategic_theme_id, activity_id, submitter_id, team_id, team_name, team_members, attachments, submitted_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (ideaRow) {
      currentStage = Number((ideaRow as any).current_stage ?? 0);
      statusStr = String((ideaRow as any).status ?? 'draft');
      ideaTitle =
        locale === 'ar'
          ? (ideaRow as any).title_ar || (ideaRow as any).title_en || ''
          : (ideaRow as any).title_en || (ideaRow as any).title_ar || '';
      ideaCode = (ideaRow as any).code ?? null;
      submittedAt = (ideaRow as any).submitted_at ?? null;
      updatedAt = (ideaRow as any).updated_at ?? null;
      submitterId = (ideaRow as any).submitter_id ?? null;
      const rawAttach = (ideaRow as any).attachments;
      if (Array.isArray(rawAttach)) {
        attachments = rawAttach as any;
      }

      // Theme
      if ((ideaRow as any).strategic_theme_id) {
        const { data: th } = await supabase
          .from('strategic_themes')
          .select('name_ar, name_en')
          .eq('id', (ideaRow as any).strategic_theme_id)
          .maybeSingle();
        if (th) {
          themeName =
            locale === 'ar'
              ? (th as any).name_ar || (th as any).name_en
              : (th as any).name_en || (th as any).name_ar;
        }
      }
      // Activity / challenge
      if ((ideaRow as any).activity_id) {
        const { data: act } = await supabase
          .from('activities')
          .select('name_ar, name_en, title_ar, title_en')
          .eq('id', (ideaRow as any).activity_id)
          .maybeSingle();
        if (act) {
          challengeName =
            locale === 'ar'
              ? (act as any).name_ar || (act as any).title_ar || (act as any).name_en || (act as any).title_en
              : (act as any).name_en || (act as any).title_en || (act as any).name_ar || (act as any).title_ar;
        }
      }
      // Team — prefer the new inline columns (written by the submission wizard),
      // fall back to the legacy team_id → teams/team_members lookup for older ideas.
      const inlineTeamName = (ideaRow as any).team_name ?? null;
      const inlineMembers = (ideaRow as any).team_members;
      if (inlineTeamName && Array.isArray(inlineMembers) && inlineMembers.length > 0) {
        teamName = inlineTeamName;
        teamMembers = (inlineMembers as any[]).map((m, i) => ({
          id: `inline-${i}`,
          full_name: m?.name ?? null,
          email: m?.email ?? null,
          role_title: null,
          is_leader: i === 0,
        }));
      } else if ((ideaRow as any).team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('name, leader_id')
          .eq('id', (ideaRow as any).team_id)
          .maybeSingle();
        teamName = (team as any)?.name ?? null;
        const leaderId = (team as any)?.leader_id ?? null;

        const { data: memberRows } = await supabase
          .from('team_members')
          .select('user_id, role, role_title')
          .eq('team_id', (ideaRow as any).team_id);
        const memberIds = ((memberRows as any[]) ?? []).map((m) => m.user_id);
        if (memberIds.length) {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id, full_name, full_name_ar, email')
            .in('id', memberIds);
          const roleMap = new Map<string, { role: string | null; role_title: string | null }>();
          for (const m of (memberRows as any[]) ?? [])
            roleMap.set(m.user_id, { role: m.role, role_title: m.role_title ?? null });
          teamMembers = ((profs as any[]) ?? []).map((p) => {
            const meta = roleMap.get(p.id) ?? { role: null, role_title: null };
            return {
              id: p.id,
              full_name: locale === 'ar' ? p.full_name_ar || p.full_name : p.full_name || p.full_name_ar,
              email: p.email ?? null,
              role_title: meta.role_title,
              is_leader: p.id === leaderId || meta.role === 'leader',
            };
          });
          // Leader first
          teamMembers.sort((a, b) => (a.is_leader === b.is_leader ? 0 : a.is_leader ? -1 : 1));
        }
      }
    }
  }

  // Fallback for demo data
  if (!ideaTitle) ideaTitle = locale === 'ar' ? idea.title_ar : idea.title_en;
  if (!ideaCode) ideaCode = idea.code;
  if (!statusStr) statusStr = idea.status;
  if (!currentStage) currentStage = idea.current_stage;

  const isOwner = !!currentUser && submitterId === currentUser.id;
  const canEdit = isOwner && (statusStr === 'returned' || statusStr === 'draft');
  const isReturned = statusStr === 'returned';

  return (
    <AppShell>
      {justSubmitted && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">{t('submitSuccessTitle')}</p>
            <p className="text-emerald-700">{t('submitSuccessBody')}</p>
          </div>
        </div>
      )}
      <IdeaHero
        locale={locale}
        ideaId={id}
        ideaCode={ideaCode}
        title={ideaTitle}
        currentStage={currentStage}
        status={statusStr}
        themeName={themeName}
        challengeName={challengeName}
        teamMembers={teamMembers}
        teamName={teamName}
        canEdit={canEdit}
        isReturned={isReturned}
      />

      {/* Reviewer notes — only when the idea was returned for revision, pinned
          to the top with an amber surface so the innovator acts on them first. */}
      {isReturned && (
        <div className="mt-6">
          <FeedbackSection feedback={feedback} locale={locale} highlight />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('ideaDescription')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              <p>{idea.proposed_solution || '—'}</p>
            </CardContent>
          </Card>

          {/* Attachments */}
          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-brand-teal">{t('attachments')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {attachments.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-xs font-bold uppercase text-brand-teal">
                          {(a.type || 'FILE').split('/').pop()?.slice(0, 4) || 'FILE'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.name}</div>
                          {a.size !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {(a.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          )}
                        </div>
                      </div>
                      {a.url && (
                        <a
                          href={a.url}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {tc('download')}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Side rail — 1/3 */}
        <div className="space-y-6">
          {/* Team — inside details page */}
          {teamMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-brand-teal">
                  {locale === 'ar' ? `الفريق — ${teamName ?? ''}` : `Team — ${teamName ?? ''}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {teamMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-xs font-bold text-white">
                          {(m.full_name ?? '?').trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{m.full_name ?? '—'}</div>
                          {m.email && (
                            <div className="truncate text-xs text-muted-foreground" dir="ltr">
                              {m.email}
                            </div>
                          )}
                          {m.role_title && (
                            <div className="truncate text-xs text-muted-foreground">
                              {m.role_title}
                            </div>
                          )}
                        </div>
                      </div>
                      {m.is_leader && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          {locale === 'ar' ? 'قائد الفريق' : 'Leader'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Submission metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">
                {locale === 'ar' ? 'بيانات التقديم' : 'Submission info'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label={locale === 'ar' ? 'تاريخ التقديم' : 'Submitted on'}
                value={submittedAt ? formatDate(submittedAt, locale) : '—'}
              />
              <Row
                label={locale === 'ar' ? 'آخر تحديث' : 'Last updated'}
                value={updatedAt ? formatDate(updatedAt, locale) : '—'}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
