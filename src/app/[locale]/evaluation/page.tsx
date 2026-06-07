import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { EvaluationScorecard } from '@/components/evaluation-scorecard';
import { fetchIdeas } from '@/lib/data';

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluation');
  const ideas = await fetchIdeas();
  const queue = ideas.filter((i) => i.status === 'evaluation');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.map((i) => (
              <div key={i.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-gold">{i.code}</span>
                  <StatusBadge status={i.status} locale={locale} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm font-medium">
                  {locale === 'ar' ? i.title_ar : i.title_en}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <h2 className="section-title mb-3">{t('scorecard')}</h2>
          <EvaluationScorecard locale={locale} />
        </div>
      </div>
    </AppShell>
  );
}
