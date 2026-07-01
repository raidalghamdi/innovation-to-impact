import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { fetchIdeas } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { StageTimeline } from '@/components/stage-timeline';
import { Lightbulb, Plus, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function MyIdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideas');
  const tc = await getTranslations('common');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  // Identify current user
  const supabase = await createClient();
  let userId: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }

  // Fetch ideas - if user identified, filter by submitter_id; otherwise show empty.
  const allIdeas = await fetchIdeas();
  const myIdeas = userId
    ? allIdeas.filter((i) => i.submitter_id === userId)
    : [];

  return (
    <AppShell>
      <PageHeader
        title={t('myIdeasTitle')}
        subtitle={t('myIdeasSubtitle')}
        action={
          <Link href="/ideas/new">
            <Button>
              <Plus className="h-4 w-4" />
              {t('new')}
            </Button>
          </Link>
        }
      />

      {myIdeas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-light">
              <Lightbulb className="h-8 w-8 text-brand-teal" />
            </div>
            <p className="text-sm text-muted-foreground">{t('emptyMyIdeas')}</p>
            <Link href="/ideas/new">
              <Button>
                <Plus className="h-4 w-4" />
                {t('new')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {myIdeas.map((idea) => (
            <li key={idea.id}>
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-brand-gold">{idea.code}</p>
                      <h2 className="text-lg font-semibold text-foreground">
                        {locale === 'ar' ? idea.title_ar : idea.title_en}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {t('submittedOn')}: {formatDate(idea.created_at, locale)}
                        </span>
                        <span>·</span>
                        <span>
                          {t('currentStage')}: <span className="font-medium text-foreground">{idea.current_stage}/8</span>
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={idea.status} locale={locale} />
                  </div>

                  <StageTimeline current={idea.current_stage} />

                  <div className="flex justify-end">
                    <Link
                      href={`/ideas/${idea.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
                    >
                      <span>{t('viewDetails')}</span>
                      <Chevron className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
