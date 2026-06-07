import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { StageTimeline } from '@/components/stage-timeline';
import { Link } from '@/i18n/routing';
import { fetchIdeas } from '@/lib/data';
import { ideas as demoIdeas, userName, themeName, activityName, benefits } from '@/lib/demo-data';
import { formatDate } from '@/lib/utils';

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const tc = await getTranslations('common');

  const allIdeas = await fetchIdeas();
  const idea = allIdeas.find((i) => i.id === id) ?? demoIdeas.find((i) => i.id === id);
  if (!idea) notFound();

  const related = allIdeas.filter(
    (o) => o.id !== idea.id && (o.category === idea.category || o.strategic_theme_id === idea.strategic_theme_id)
  ).slice(0, 4);
  const ideaBenefits = benefits.filter((b) => b.idea_id === idea.id);

  return (
    <AppShell>
      <PageHeader
        title={locale === 'ar' ? idea.title_ar : idea.title_en}
        subtitle={`${idea.code} · ${tc('stage')} ${idea.current_stage}`}
        action={<StatusBadge status={idea.status} locale={locale} />}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('timeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StageTimeline current={idea.current_stage} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('problemStatement')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{idea.problem_statement}</p>
              <div>
                <p className="mb-1 font-medium text-foreground">{t('proposedSolution')}</p>
                <p className="text-muted-foreground">{idea.proposed_solution}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">{t('expectedBenefits')}</p>
                <p className="text-muted-foreground">{idea.expected_benefits}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('benefits')}</CardTitle>
            </CardHeader>
            <CardContent>
              {ideaBenefits.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tc('noData')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {ideaBenefits.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <span>{b.category} ({b.benefit_type})</span>
                      <span className="font-medium">
                        {b.realized_value} / {b.target_value} {b.measurement_unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{tc('actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t('theme')} value={themeName(idea.strategic_theme_id, locale)} />
              <Row label={t('activity')} value={activityName(idea.activity_id, locale)} />
              <Row label={t('category')} value={idea.category} />
              <Row label={t('submitter')} value={userName(idea.submitter_id)} />
              <Row label={t('confidentiality')} value={idea.confidentiality} />
              <Row label={tc('date')} value={formatDate(idea.created_at, locale)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-teal">{t('relationships')}</CardTitle>
            </CardHeader>
            <CardContent>
              {related.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tc('noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/ideas/${r.id}`}
                        className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted/50"
                      >
                        <span className="line-clamp-1">{locale === 'ar' ? r.title_ar : r.title_en}</span>
                        <span className="text-xs text-brand-gold">{r.code}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
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
