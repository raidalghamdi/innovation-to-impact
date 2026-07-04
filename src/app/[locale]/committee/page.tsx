import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import {
  CommitteeDecisionPanel,
  type CommitteeIdea,
} from '@/components/committee-decision-panel';
import { fetchIdeas, fetchEvaluationSummaries } from '@/lib/data';

export default async function CommitteePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('committee');
  const ideas = await fetchIdeas();
  const queue = ideas.filter((i) => i.status === 'committee');
  const summaries = await fetchEvaluationSummaries(queue.map((i) => i.id));

  const enriched: CommitteeIdea[] = queue.map((i) => {
    const s = summaries[i.id];
    return {
      id: i.id,
      code: i.code,
      title_ar: i.title_ar,
      title_en: i.title_en,
      problem_statement: i.problem_statement,
      proposed_solution: i.proposed_solution,
      expected_benefits: i.expected_benefits,
      summary: s
        ? {
            count: s.count,
            avgTotal: s.avgTotal,
            perCriterion: s.perCriterion,
            conflicts: s.conflicts,
          }
        : null,
    };
  });

  // demo quorum: 5 of 7 members present
  const present = 5;
  const required = 5;
  const quorumMet = present >= required;

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-muted-foreground">{t('quorum')}</p>
            <p className="text-lg font-semibold">{present} / 7</p>
          </div>
          <StatusBadge status={quorumMet ? 'compliant' : 'non_compliant'} locale={locale} />
        </CardContent>
      </Card>

      <CommitteeDecisionPanel ideas={enriched} locale={locale} quorumMet={quorumMet} />
    </AppShell>
  );
}
