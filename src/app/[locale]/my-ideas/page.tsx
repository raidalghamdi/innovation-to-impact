import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { fetchIdeas } from '@/lib/data';
import { StatusBadge } from '@/components/status-badge';
import { PioneerBadge, isPioneerIdea } from '@/components/pioneer-badge';
import { FeedbackCountBadge } from '@/components/feedback-section';
import { getFeedbackCountsForSubmitter } from '@/lib/feedback';
import { EmptyState } from '@/components/empty-state';
import { WithdrawIdeaButton } from '@/components/withdraw-idea-button';
import { Lightbulb, ChevronLeft, ChevronRight, Calendar, Clock, MessageSquareWarning, Send } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Status groups shared with the dashboard KPI cards — the "In Review" and
// "Accepted" KPI tiles deep-link here with ?status=in_review / ?status=approved
// and must resolve to the exact same set of ideas they counted.
const STATUS_GROUPS: Record<string, string[]> = {
  in_review: ['submitted', 'screening', 'evaluation', 'committee', 'needs_completion'],
  approved: ['approved', 'assigned', 'in_pilot', 'in_implementation', 'benefits_tracking', 'closed'],
  returned: ['returned'],
};

// Statuses at which the innovator can still withdraw their idea. The idea has
// NOT yet reached a technical evaluator. Once assigned to an evaluator
// (status='evaluation'/'assigned'/anything downstream), withdrawal is locked.
// Tied to the real workflow status — do NOT rely on `current_stage`, which does
// not reliably advance in the database.
const WITHDRAWABLE_STATUSES = new Set(['draft', 'submitted', 'screening', 'needs_completion', 'returned']);

export default async function MyIdeasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: statusParam } = await searchParams;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const t = await getTranslations('ideas');
  const tc = await getTranslations('common');
  const te = await getTranslations('emptyStates');
  const tf = await getTranslations('feedback');
  const tfin = await getTranslations('innovator.finalize');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  // Identify current user
  const supabase = await createClient();
  let userId: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }

  // Fetch ideas - if user identified, filter by submitter_id; otherwise show empty.
  // Sort ALL ideas (old + new) newest first by the most recent activity timestamp
  // (updated_at falls back to created_at). Applies across every status tab.
  const allIdeas = await fetchIdeas();
  const allMine = (userId ? allIdeas.filter((i) => i.submitter_id === userId) : []).slice().sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  // Preselect the status chip from the KPI deep-link. Unknown values fall back
  // to "all" so a stale/bad query param never renders an empty list.
  const activeStatus =
    statusParam && STATUS_GROUPS[statusParam] ? statusParam : 'all';
  const myIdeas =
    activeStatus === 'all'
      ? allMine
      : allMine.filter((i) => STATUS_GROUPS[activeStatus].includes(i.status));

  const STATUS_CHIPS: { key: string; label: string; href: string }[] = [
    { key: 'all', label: isAr ? 'الكل' : 'All', href: '/my-ideas' },
    { key: 'in_review', label: isAr ? 'قيد المراجعة' : 'In Review', href: '/my-ideas?status=in_review' },
    { key: 'approved', label: isAr ? 'مقبولة' : 'Accepted', href: '/my-ideas?status=approved' },
    { key: 'returned', label: t('returnedTab'), href: '/my-ideas?status=returned' },
  ];

  // Feedback counts — empty map when unauthenticated. Never one-query-per-idea.
  const feedbackCounts = userId ? await getFeedbackCountsForSubmitter(userId) : {};

  return (
    <AppShell>
      {/* R42-later Item 2: the "قائمة الأفكار / New Idea" header button was
          removed per the user's request ("بند قائمة الأفكار تحذف"). Submitting a
          new idea is still reachable from the dashboard CTA and the empty-state
          CTA below — nothing else on this page changes. */}
      <PageHeader
        title={t('myIdeasTitle')}
        subtitle={t('myIdeasSubtitle')}
      />

      {/* Status filter chips — preselected when arriving from a dashboard KPI. */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {STATUS_CHIPS.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href as any}
            role="tab"
            aria-selected={activeStatus === chip.key}
            className={
              activeStatus === chip.key
                ? 'rounded-full bg-brand-teal px-4 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted'
            }
          >
            {chip.label}
          </Link>
        ))}
      </div>

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

                  {/* Post-pass finalize CTA — prominent, shown when the idea
                      passed evaluation and awaits its final attachments. */}
                  {idea.status === 'pass_awaiting_attachments' && (
                    <Link
                      href={`/ideas/${idea.id}/finalize`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/40 bg-amber-50 p-4 transition hover:bg-amber-100"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-teal">
                          {tfin('title')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tfin('description')}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-gold px-3 py-1.5 text-sm font-medium text-slate-900">
                        <Send className="h-4 w-4" />
                        {tfin('submitToCommittee')}
                      </span>
                    </Link>
                  )}

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
                    {WITHDRAWABLE_STATUSES.has(idea.status) && (
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
