import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listEvidence } from '@/lib/storage';
import { fetchEvaluationForIdea } from '@/app/[locale]/evaluation/actions';
import type { EvidenceWithUrl } from '@/lib/evidence-types';
import { EvaluationDetail } from '@/components/evaluator/evaluation-detail';
import type { EvScores } from '@/lib/evaluator-criteria';
import { computeIdeaStage } from '@/lib/idea-journey';
import type { JourneyTimelineStage } from '@/components/idea-journey-timeline';

export default async function EvaluatorIdeaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const supabase = await createClient();
  if (!supabase) notFound();

  // Round 29: mirror the submitter's own idea details page — the evaluator
  // must see the same identity fields the innovator filled in the wizard:
  // event (activity), track (strategic theme), challenge (from
  // original_source_metadata), idea code, submitted-at, participation type.
  const { data: ideaRow } = await supabase
    .from('ideas')
    .select(
      'id, code, title_ar, title_en, status, current_stage, proposed_solution, strategic_theme_id, activity_id, participation_type, original_source_metadata, submitted_at, updated_at, created_at, attachments'
    )
    .eq('id', id)
    .maybeSingle();
  if (!ideaRow) notFound();

  const row = ideaRow as any;
  const title = (isAr ? row.title_ar : row.title_en) || row.title_en || row.title_ar || '';

  // Anonymized submitter pseudonym — evaluators must never see the innovator's
  // real name/email (PII). Mirrors innovation.anonymous_innovator_label():
  // last 3 hex chars of the idea id, uppercased.
  const idSuffix = String(id).replace(/-/g, '').slice(-3).toUpperCase();
  const innovatorLabel = `${isAr ? 'مبتكر' : 'Innovator'} #${idSuffix}`;

  // Track name
  let trackName: string | null = null;
  if (row.strategic_theme_id) {
    const { data: th } = await supabase
      .from('strategic_themes')
      .select('name_ar, name_en')
      .eq('id', row.strategic_theme_id)
      .maybeSingle();
    if (th) trackName = isAr ? (th as any).name_ar || (th as any).name_en : (th as any).name_en || (th as any).name_ar;
  }

  // Activity (event) name
  let activityName: string | null = null;
  if (row.activity_id) {
    const { data: act } = await supabase
      .from('activities')
      .select('name_ar, name_en')
      .eq('id', row.activity_id)
      .maybeSingle();
    if (act) activityName = isAr ? (act as any).name_ar || (act as any).name_en : (act as any).name_en || (act as any).name_ar;
  }

  // Challenge — stored as free text in the JSONB metadata blob by the wizard.
  let challengeName: string | null = null;
  const meta = row.original_source_metadata;
  if (meta && typeof meta === 'object' && (meta as any).challenge) {
    challengeName = String((meta as any).challenge);
  }

  // Participation type — no team member names, just the type itself
  // (individual / team) per Round 29 point 3.
  const participationType: 'individual' | 'team' | null =
    row.participation_type === 'individual' || row.participation_type === 'team'
      ? row.participation_type
      : null;

  const attachments: EvidenceWithUrl[] = await listEvidence('idea', id);

  const existing = await fetchEvaluationForIdea(id);
  const already = existing.evaluation?.submitted_at ? existing.evaluation : null;
  const existingScores = (already?.criteria_scores ?? null) as Partial<EvScores> | null;

  // Dynamic six-stage journey — mirrors the innovator idea detail page so
  // evaluators see the same progress. Related rows advance the journey;
  // failures degrade gracefully to empty lists (status signal alone).
  const [{ data: asg }, { data: evals }, { data: cmte }] = await Promise.all([
    supabase.from('assignments').select('created_at').eq('idea_id', id),
    supabase.from('evaluations').select('submitted_at, total_score, criteria_scores').eq('idea_id', id),
    supabase.from('committee_decisions').select('decision, decided_at').eq('idea_id', id),
  ]);
  const journey = computeIdeaStage(
    {
      status: row.status ?? 'submitted',
      current_stage: Number(row.current_stage ?? 0),
      submitted_at: row.submitted_at ?? null,
      updated_at: row.updated_at ?? null,
      created_at: row.created_at ?? null,
    },
    (asg as any[]) ?? [],
    (evals as any[]) ?? [],
    (cmte as any[]) ?? []
  );
  const journeyStages: JourneyTimelineStage[] = journey.stages.map((s) => ({
    index: s.index,
    state: s.state,
    completedAtISO: s.completedAt ? s.completedAt.toISOString() : null,
    label: s.label,
  }));

  return (
    <EvaluationDetail
      locale={locale}
      ideaId={id}
      code={row.code ?? null}
      status={row.status ?? 'submitted'}
      title={title}
      trackName={trackName}
      activityName={activityName}
      challengeName={challengeName}
      innovatorLabel={innovatorLabel}
      description={row.proposed_solution ?? null}
      submittedAt={row.submitted_at ?? null}
      updatedAt={row.updated_at ?? null}
      participationType={participationType}
      journeyStages={journeyStages}
      journeyStopped={journey.stopped}
      attachments={attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        downloadUrl: a.downloadUrl,
        contentType: a.content_type ?? null,
        sizeBytes: a.size_bytes ?? null,
      }))}
      readOnly={!!already}
      existingScores={existingScores}
      existingNotes={already?.comments ?? null}
    />
  );
}
