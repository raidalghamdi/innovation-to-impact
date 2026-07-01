import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { StageTimeline } from '@/components/stage-timeline';
import { StatsBlock } from '@/components/stats-block';
import { BackToTop } from '@/components/back-to-top';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { fetchIdeas } from '@/lib/data';
import { getStats } from '@/lib/demo-data';
import { formatDate } from '@/lib/utils';
import {
  Lightbulb,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('common');
  const stats = getStats();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  // Get current user and their ideas
  const supabase = await createClient();
  const userId = supabase
    ? (await supabase.auth.getUser()).data.user?.id
    : null;
  const allIdeas = await fetchIdeas();
  const myIdeas = userId
    ? allIdeas.filter((i: any) => i.submitter_id === userId).slice(0, 3)
    : [];

  return (
    <AppShell>
      {/* ===== Welcome strip — what to do today ===== */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-6 text-white sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-cyan-light">
          {t('welcomeBack')}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t('whatToDo')}</h1>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/ideas/new"
            className="group flex items-center gap-3 rounded-2xl bg-white/95 p-4 text-brand-teal transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-light">
              <Lightbulb className="h-5 w-5" />
            </div>
            <span className="flex-1 text-sm font-semibold">{t('submitNewIdea')}</span>
            <Chevron className="h-4 w-4 opacity-60 transition group-hover:opacity-100" />
          </Link>
        </div>
      </section>

      {/* ===== My recent ideas — only if logged in ===== */}
      {userId && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-brand-teal">{t('myRecentIdeas')}</h2>
            <Link
              href="/my-ideas"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
            >
              {t('viewAll' as any)}
              <Chevron className="h-3.5 w-3.5" />
            </Link>
          </div>

          {myIdeas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t('noIdeasYet')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('submitFirst')}</p>
                </div>
                <Button asChild size="sm">
                  <Link href="/ideas/new">
                    <Lightbulb className="h-4 w-4" />
                    {t('submitNewIdea')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {myIdeas.map((idea: any) => (
                <Link
                  key={idea.id}
                  href={`/ideas/${idea.id}` as any}
                  className="block rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-brand-cyan">{idea.code}</span>
                    <StatusBadge status={idea.status} locale={locale} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">
                    {locale === 'ar' ? idea.title_ar : idea.title_en}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(idea.created_at, locale)}
                  </p>
                  <div className="mt-3">
                    <StageTimeline current={idea.current_stage} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== Platform activity with timeframe toggle ===== */}
      <section className="mt-10">
        <div className="mb-2">
          <h2 className="text-xl font-bold text-brand-teal">{t('platformActivity')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('platformActivityHint')}</p>
        </div>
        <StatsBlock stats={stats} locale={locale} />
      </section>

      {/* ===== Final CTA ===== */}
      <section className="mt-10 rounded-3xl border border-brand-cyan/20 bg-gradient-to-br from-brand-teal-light/40 to-brand-cyan-light/40 p-6 text-center sm:p-8">
        <h3 className="text-xl font-bold text-brand-teal sm:text-2xl">{t('finalCtaTitle')}</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          {t('finalCtaSubtitle')}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/ideas/new">
              <Lightbulb className="h-4 w-4" />
              {t('submitNewIdea')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-brand-teal text-brand-teal hover:bg-brand-teal-light">
            <Link href="/stages">{t('viewAll' as any) || 'Explore stages'}</Link>
          </Button>
        </div>
      </section>

      <BackToTop label={tc('backToTop')} />
    </AppShell>
  );
}
