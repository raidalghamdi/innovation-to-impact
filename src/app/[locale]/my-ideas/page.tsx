import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { fetchIdeas } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { PipelineIndicator } from '@/components/pipeline-indicator';
import { PioneerBadge, isPioneerIdea } from '@/components/pioneer-badge';
import { FeedbackCountBadge } from '@/components/feedback-section';
import { getFeedbackCountsForSubmitter } from '@/lib/feedback';
import { EmptyState } from '@/components/empty-state';
import { WithdrawIdeaButton } from '@/components/withdraw-idea-button';
import { Lightbulb, Plus, ChevronLeft, ChevronRight, Calendar, Clock, MessageSquareWarning } from 'lucide-react';
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
  const te = await getTranslations('emptyStates');
  const tf = await getTranslations('feedback');
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

  // Feedback counts — empty map when unauthenticated. Never one-query-per-idea.
  const feedbackCounts = userId ? await getFeedbackCountsForSubmitter(userId) : {};

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
        <EmptyState
          icon={Lightbulb}
          title={te('myIdeasTitle')}
          description={te('myIdeasBody')}
          cta={{ label: te('myIdeasCta'), href: '/ideas/new' }}
        />
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
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {t('submittedOn')}: {formatDate(idea.created_at, locale)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {tc('lastUpdated')}: {formatDate(idea.updated_at ?? idea.created_at, locale)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isPioneerIdea(idea.current_stage) && <PioneerBadge />}
                      <FeedbackCountBadge
                        count={feedbackCounts[idea.id] ?? 0}
                        label={tf('countBadge')}
                      />
                      <StatusBadge status={idea.status} locale={locale} />
                    </div>
                  </div>

                  <PipelineIndicator current={idea.current_stage} />

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {idea.status === 'returned' && (
                      <Link
                        href={`/ideas/${idea.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                      >
                        <MessageSquareWarning className="h-4 w-4" />
                        <span>{t('viewFeedbackCta')}</span>
                      </Link>
                    )}
                    {idea.current_stage <= 2 && idea.status !== 'withdrawn' && (
                      <WithdrawIdeaButton ideaId={idea.id} />
                    )}
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
