import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listEvidence } from '@/lib/storage';
import { fetchEvaluationForIdea } from '@/app/[locale]/evaluation/actions';
import type { EvidenceWithUrl } from '@/lib/evidence-types';
import { EvaluationDetail } from '@/components/evaluator/evaluation-detail';
import type { EvScores } from '@/lib/evaluator-criteria';

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

  const { data: ideaRow } = await supabase
    .from('ideas')
    .select(
      'id, code, title_ar, title_en, status, problem_statement, proposed_solution, strategic_theme_id, submitted_at, team_name, team_members'
    )
    .eq('id', id)
    .maybeSingle();
  if (!ideaRow) notFound();

  const row = ideaRow as any;
  const title = (isAr ? row.title_ar : row.title_en) || row.title_en || row.title_ar || '';

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

  // Team members (inline columns written by the wizard)
  const inlineMembers = Array.isArray(row.team_members) ? row.team_members : [];
  const team = inlineMembers.map((m: any, i: number) => ({
    name: m?.name ?? null,
    isLeader: i === 0,
  }));

  // Video presence
  let videoUrl: string | null = null;
  const { data: vid } = await supabase
    .from('video_assets')
    .select('idea_id')
    .eq('idea_id', id)
    .maybeSingle();
  const hasVideo = !!vid;

  const attachments: EvidenceWithUrl[] = await listEvidence('idea', id);

  const existing = await fetchEvaluationForIdea(id);
  const already = existing.evaluation?.submitted_at ? existing.evaluation : null;
  const existingScores = (already?.criteria_scores ?? null) as Partial<EvScores> | null;

  return (
    <EvaluationDetail
      locale={locale}
      ideaId={id}
      code={row.code ?? null}
      status={row.status ?? 'submitted'}
      title={title}
      trackName={trackName}
      problem={row.problem_statement ?? null}
      solution={row.proposed_solution ?? null}
      submittedAt={row.submitted_at ?? null}
      teamName={row.team_name ?? null}
      team={team}
      hasVideo={hasVideo}
      videoUrl={videoUrl}
      attachments={attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        contentType: a.content_type ?? null,
      }))}
      readOnly={!!already}
      existingScores={existingScores}
      existingNotes={already?.comments ?? null}
    />
  );
}
