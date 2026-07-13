import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { FinalizeForm, type EvaluationCard } from '@/components/finalize-form';
import { countPostPassAttachments } from '@/app/[locale]/ideas/[id]/finalize/actions';

/**
 * /ideas/[id]/finalize — post-pass finalize page.
 *
 * Gated to the idea's submitter while status='pass_awaiting_attachments';
 * anyone else (or any other status) is redirected to the idea details page.
 * Aggregates every submitted evaluation into a read-only per-evaluator summary
 * so the innovator can review their scores before uploading the mandatory
 * supporting attachments and submitting to the committee. Evaluations are read
 * with the service-role client so the innovator sees all reviewers' comments on
 * their own idea.
 */
export default async function FinalizePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const t = await getTranslations('innovator.finalize');

  const user = await getCurrentUser();

  // Prefer the service-role client so the innovator can read every evaluation
  // on their own idea; fall back to the RLS-scoped client when it is unset.
  const admin = createAdminClient();
  const db = admin ?? (await createClient());
  if (!db || !user) redirect(`/${locale}/ideas/${id}`);

  const { data: ideaRow } = await db
    .from('ideas')
    .select('id, submitter_id, status, code, evaluation_avg_score, title_ar, title_en')
    .eq('id', id)
    .maybeSingle();

  const idea = ideaRow as
    | {
        id: string;
        submitter_id: string | null;
        status: string | null;
        code: string | null;
        evaluation_avg_score: number | null;
        title_ar: string | null;
        title_en: string | null;
      }
    | null;

  if (
    !idea ||
    idea.submitter_id !== user.id ||
    idea.status !== 'pass_awaiting_attachments'
  ) {
    redirect(`/${locale}/ideas/${id}`);
  }

  // All submitted evaluations for this idea. Column set mirrors the evaluator
  // save path (src/app/[locale]/evaluation/actions.ts): evaluator_id,
  // total_score, comments, submitted_at.
  const { data: evalRows } = await db
    .from('evaluations')
    .select('id, evaluator_id, total_score, comments, submitted_at')
    .eq('idea_id', id)
    .not('submitted_at', 'is', null);

  const rows =
    (evalRows as
      | {
          id: string;
          evaluator_id: string | null;
          total_score: number | null;
          comments: string | null;
          submitted_at: string | null;
        }[]
      | null) ?? [];

  const evaluations: EvaluationCard[] = rows.map((r, i) => ({
    id: r.id ?? `eval-${i}`,
    // Reviewers stay anonymous to the innovator — numbered labels only.
    reviewerLabel: isAr ? `المُقيّم ${i + 1}` : `Reviewer ${i + 1}`,
    score: typeof r.total_score === 'number' ? r.total_score : null,
    comment: r.comments ?? null,
  }));

  const scores = evaluations
    .map((e) => e.score)
    .filter((s): s is number => typeof s === 'number');
  const averageScore =
    typeof idea.evaluation_avg_score === 'number'
      ? idea.evaluation_avg_score
      : scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

  const initialCount = await countPostPassAttachments(id);

  const ideaTitle = isAr
    ? idea.title_ar || idea.title_en || ''
    : idea.title_en || idea.title_ar || '';

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={[idea.code, ideaTitle].filter(Boolean).join(' — ') || undefined}
      />
      <FinalizeForm
        ideaId={id}
        locale={locale}
        evaluations={evaluations}
        averageScore={averageScore}
        initialCount={initialCount}
      />
    </AppShell>
  );
}
