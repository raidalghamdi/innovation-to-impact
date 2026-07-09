import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { JudgeSimplePanel, type JudgeIdea } from '@/components/judge-simple-panel';
import {
  fetchIdeas,
  fetchThemes,
  fetchEvaluationSummaries,
} from '@/lib/data';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';

export default async function CommitteePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('committee');
  const isAr = locale === 'ar';

  // Guard: only judge / committee / admin may access this page.
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const isJudge = await userHasRole(user.id, 'judge');
  const isCommittee = await userHasRole(user.id, 'committee');
  if (!isJudge && !isCommittee && user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const [ideas, themes] = await Promise.all([fetchIdeas(), fetchThemes()]);
  const queue = ideas.filter((i) => i.status === 'committee');
  const summaries = await fetchEvaluationSummaries(queue.map((i) => i.id));

  const themeById = new Map(themes.map((th) => [th.id, th]));

  const enriched: JudgeIdea[] = queue.map((i) => {
    const s = summaries[i.id];
    const theme = i.strategic_theme_id ? themeById.get(i.strategic_theme_id) : null;
    return {
      id: i.id,
      code: i.code ?? null,
      title_ar: i.title_ar ?? null,
      title_en: i.title_en ?? null,
      problem_statement: i.problem_statement ?? null,
      proposed_solution: i.proposed_solution ?? null,
      theme_ar: theme?.name_ar ?? null,
      theme_en: theme?.name_en ?? null,
      avg_score: s?.avgTotal ?? null,
      evaluations_count: s?.count ?? 0,
    };
  });

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          {isAr
            ? 'واجهة المحكّم: قرار واحد بسيط لكل فكرة. تظهر لك ملخصات المقيّمين (متوسط الدرجة وعدد التقييمات) دون كشف هوية المقيّمين أو المبتكرين.'
            : "Judge view: a single simple decision per idea. Evaluator averages are shown but evaluator and innovator identities remain hidden."}
        </CardContent>
      </Card>

      <JudgeSimplePanel ideas={enriched} locale={locale} />
    </AppShell>
  );
}
