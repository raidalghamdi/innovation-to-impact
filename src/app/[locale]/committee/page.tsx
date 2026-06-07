import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { fetchIdeas } from '@/lib/data';
import { CheckCircle2, XCircle, RotateCcw, Search } from 'lucide-react';

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

      <div className="space-y-4">
        {queue.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">—</CardContent></Card>
        ) : (
          queue.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-brand-teal">
                    {locale === 'ar' ? i.title_ar : i.title_en}
                  </CardTitle>
                  <span className="text-xs font-medium text-brand-gold">{i.code}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{i.problem_statement}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={!quorumMet}>
                    <CheckCircle2 className="h-4 w-4" />{t('approve')}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!quorumMet}>
                    <XCircle className="h-4 w-4" />{t('reject')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!quorumMet}>
                    <RotateCcw className="h-4 w-4" />{t('return')}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!quorumMet}>
                    <Search className="h-4 w-4" />{t('study')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
