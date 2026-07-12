import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchIdeas } from '@/lib/data';
import { ideas as demoIdeas } from '@/lib/demo-data';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Download, Eye, FileText } from 'lucide-react';
import { getFeedbackForIdea } from '@/lib/feedback';
import { FeedbackSection } from '@/components/feedback-section';
import { IdeaHero } from '@/components/idea-hero';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { listEvidence } from '@/lib/storage';
import { formatFileSize, type EvidenceWithUrl } from '@/lib/evidence-types';
import { computeIdeaStage } from '@/lib/idea-journey';
import type { JourneyTimelineStage } from '@/components/idea-journey-timeline';

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

  // Campaign / track / challenge names
  let campaignName: string | null = null;
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
  let submittedAt: string | null = null;
  let updatedAt: string | null = null;
  let createdAt: string | null = null;
  let currentStage = 0;
  let statusStr = 'draft';
  // Cross-table signals used to derive the six-stage journey dynamically.
  let assignmentRows: Array<{ created_at: string | null }> = [];
  let evaluationRows: Array<{ submitted_at: string | null }> = [];
  let committeeRows: Array<{ decision: string | null; decided_at: string | null }> = [];
  let ideaTitle = '';
  let ideaCode: string | null = null;
  let submitterId: string | null = null;
  let submitterName: string | null = null;
  let submitterEmail: string | null = null;
  // Participation type is read directly from the ideas.participation_type column
  // written by the submission wizard; falls back to team-derived when absent.
  let participationType: 'individual' | 'team' = 'individual';

  // Attachments come from the evidence ledger (bucket + evidence_attachments),
  // which is where the submission wizard actually uploads files — not the
  // legacy ideas.attachments JSONB column.
  const evidenceAttachments: EvidenceWithUrl[] = await listEvidence('idea', id);

  if (supabase) {
    const { data: ideaRow } = await supabase
      .from('ideas')
      .select(
        'id, code, title_ar, title_en, status, current_stage, strategic_theme_id, activity_id, participation_type, submitter_id, team_id, team_name, team_members, original_source_metadata, submitted_at, updated_at, created_at'
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
      createdAt = (ideaRow as any).created_at ?? null;
      submitterId = (ideaRow as any).submitter_id ?? null;

      // Related rows that advance the journey. Failures degrade gracefully to
      // an empty list — the journey then falls back to the status signal alone.
      const [{ data: asg }, { data: evals }, { data: cmte }] = await Promise.all([
        supabase.from('assignments').select('created_at').eq('idea_id', id),
        supabase.from('evaluations').select('submitted_at').eq('idea_id', id),
        supabase.from('committee_decisions').select('decision, decided_at').eq('idea_id', id),
      ]);
      assignmentRows = (asg as any[]) ?? [];
      evaluationRows = (evals as any[]) ?? [];
      committeeRows = (cmte as any[]) ?? [];

      // Challenge — free-text value chosen in the wizard, stored in the
      // source-metadata JSONB (no dedicated column).
      const meta = (ideaRow as any).original_source_metadata;
      if (meta && typeof meta === 'object' && meta.challenge) {
        challengeName = String(meta.challenge);
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
      // Activity → campaign / event (الفعالية)
      if ((ideaRow as any).activity_id) {
        const { data: act } = await supabase
          .from('activities')
          .select('name_ar, name_en')
          .eq('id', (ideaRow as any).activity_id)
          .maybeSingle();
        if (act) {
          campaignName =
            locale === 'ar'
              ? (act as any).name_ar || (act as any).name_en
              : (act as any).name_en || (act as any).name_ar;
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

      const ptCol = (ideaRow as any).participation_type;
      if (ptCol === 'team' || ptCol === 'individual') {
        participationType = ptCol;
      } else {
        participationType = teamMembers.length > 0 || teamName ? 'team' : 'individual';
      }

      // Submitter profile — shown on the individual participation card.
      if (submitterId) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('full_name, full_name_ar, email')
          .eq('id', submitterId)
          .maybeSingle();
        if (prof) {
          submitterName =
            locale === 'ar'
              ? (prof as any).full_name_ar || (prof as any).full_name
              : (prof as any).full_name || (prof as any).full_name_ar;
          submitterEmail = (prof as any).email ?? null;
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

  // Dynamic six-stage journey — derived from real state, not the stored
  // current_stage (which does not advance as the idea moves between reviewers).
  const journey = computeIdeaStage(
    {
      status: statusStr,
      current_stage: currentStage,
      submitted_at: submittedAt,
      updated_at: updatedAt,
      created_at: createdAt,
    },
    assignmentRows,
    evaluationRows,
    committeeRows
  );
  const journeyStages: JourneyTimelineStage[] = journey.stages.map((s) => ({
    index: s.index,
    state: s.state,
    completedAtISO: s.completedAt ? s.completedAt.toISOString() : null,
    label: s.label,
  }));

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
        status={statusStr}
        campaignName={campaignName}
        themeName={themeName}
        challengeName={challengeName}
        participationType={participationType}
        submittedAt={submittedAt}
        teamMembers={teamMembers}
        teamName={teamName}
        canEdit={canEdit}
        isReturned={isReturned}
        journey={journeyStages}
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
              <p className="max-w-full whitespace-pre-wrap break-words">
                {idea.proposed_solution || '—'}
              </p>
            </CardContent>
          </Card>

          {/* Attachments — inline preview (images + PDF) plus download. Always
              rendered (header + either the list or a muted empty state) so users
              always know where attachments live. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('attachments')}</CardTitle>
            </CardHeader>
            <CardContent>
              {evidenceAttachments.length > 0 ? (
                <ul className="space-y-4">
                  {evidenceAttachments.map((a) => (
                    <AttachmentRow
                      key={a.id}
                      attachment={a}
                      downloadLabel={tc('download')}
                      previewLabel={tc('openPreview')}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noAttachments')}</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Side rail — 1/3 */}
        <div className="space-y-6">
          {/* Participation type — sits directly above the team / individual card. */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t('participationType')}:
            </span>
            <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-sm font-semibold text-brand-teal">
              {participationType === 'team'
                ? t('participationTeamCount', { n: teamMembers.length })
                : t('participationIndividual')}
            </span>
          </div>

          {/* Individual — submitter info card (shown when not a team). */}
          {participationType === 'individual' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-brand-teal">{t('submitterInfo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-xs font-bold text-white">
                    {(submitterName ?? '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{submitterName ?? '—'}</div>
                    {submitterEmail && (
                      <div className="truncate text-xs text-muted-foreground" dir="ltr">
                        {submitterEmail}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team — inside details page */}
          {participationType === 'team' && teamMembers.length > 0 && (
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

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

function AttachmentRow({
  attachment,
  downloadLabel,
  previewLabel,
}: {
  attachment: EvidenceWithUrl;
  downloadLabel: string;
  previewLabel: string;
}) {
  const { filename, content_type, size_bytes, url, downloadUrl } = attachment;
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  const isImage =
    IMAGE_EXT.includes(ext) || (content_type?.startsWith('image/') ?? false);
  const isPdf = ext === 'pdf' || content_type === 'application/pdf';
  const badge = (content_type?.split('/').pop() || ext || 'file').slice(0, 4).toUpperCase();

  return (
    <li className="space-y-3 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {isImage || isPdf ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-xs font-bold uppercase text-brand-teal">
              {badge}
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal">
              <FileText className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{filename}</div>
            <div className="text-xs text-muted-foreground">{formatFileSize(size_bytes)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {url && (isImage || isPdf) && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
            >
              <Eye className="h-3.5 w-3.5" />
              {previewLabel}
            </a>
          )}
          {(downloadUrl || url) && (
            <a
              href={downloadUrl || url || undefined}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadLabel}
            </a>
          )}
        </div>
      </div>

      {/* Inline preview */}
      {url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={filename}
          className="max-h-[300px] w-full rounded-md border border-border object-contain"
        />
      )}
      {url && isPdf && (
        <iframe
          src={url}
          title={filename}
          className="h-[500px] w-full rounded-md border border-border"
        />
      )}
    </li>
  );
}
