import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { fetchIdeas } from '@/lib/data';
import { getUserPoints } from '@/lib/gamification';
import { formatDate } from '@/lib/utils';
import { Lightbulb, Clock, CheckCircle2, Award, PlusCircle, ArrowLeft, ArrowRight, Users, TrendingUp } from 'lucide-react';

// src/components/dashboards/innovator-dashboard.tsx
// Overview-only innovator dashboard.
// - Removed "ترتيب الجوائز" (Prize Position) trophy card — replaced with "مستواي" (My Level).
// - Idea status cards live on /my-ideas — this page is an at-a-glance overview.
// - Prominent primary CTA "قدم فكرة" (submit idea) at the top of the content area.
export async function InnovatorDashboard({ userId, locale }: { userId: string; locale: string }) {
  const t = await getTranslations('dashboard');
  const isAr = locale === 'ar';
  const allIdeas = await fetchIdeas();
  const myIdeas = allIdeas.filter((i: any) => i.submitter_id === userId);

  const inReview = myIdeas.filter((i: any) =>
    ['submitted', 'screening', 'evaluation', 'committee', 'needs_completion'].includes(i.status)
  ).length;
  const accepted = myIdeas.filter((i: any) =>
    ['approved', 'assigned', 'in_pilot', 'in_implementation', 'benefits_tracking', 'closed'].includes(i.status)
  ).length;

  let points = 0;
  let level = 1;
  try {
    const p = await getUserPoints(userId);
    points = p.points;
    level = p.level;
  } catch {
    // safe fallback if gamification RPC unavailable
  }

  const latest = myIdeas
    .slice()
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6">
      {/* Primary CTA — enlarged, top-of-page */}
      <div className="rounded-2xl border border-brand-teal/20 bg-gradient-to-br from-brand-teal/5 via-card to-brand-cyan/5 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-brand-teal sm:text-xl">
              {isAr ? 'عندك فكرة تخدم المنافسة العادلة؟' : 'Have an idea that serves fair competition?'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? 'شارك فكرتك الآن وتابعها في «أفكاري».'
                : 'Submit your idea now and follow it up in "My Ideas".'}
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/ideas/new">
              <PlusCircle className="h-5 w-5" />
              {isAr ? 'قدّم فكرة' : 'Submit an idea'}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI overview — no "prize position" */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={isAr ? 'أفكاري' : 'My Ideas'} value={myIdeas.length} icon={Lightbulb} />
        <KpiCard label={isAr ? 'قيد المراجعة' : 'In Review'} value={inReview} icon={Clock} />
        <KpiCard label={isAr ? 'مقبولة' : 'Accepted'} value={accepted} icon={CheckCircle2} />
        <KpiCard
          label={isAr ? 'مستواي' : 'My Level'}
          value={`L${level}`}
          icon={Award}
          hint={isAr ? `${points} نقطة` : `${points} pts`}
        />
      </div>

      {/* Quick links row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/my-ideas"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-teal/10 p-2 text-brand-teal">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{isAr ? 'أفكاري' : 'My Ideas'}</p>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'عرض جميع أفكاري وحالتها' : 'View all my ideas and their status'}
              </p>
            </div>
          </div>
          <ArrowIcon className="h-4 w-4 text-muted-foreground transition group-hover:text-brand-teal" />
        </Link>
        <Link
          href="/team"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-cyan/10 p-2 text-brand-cyan">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{isAr ? 'فريقي' : 'My Team'}</p>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'الأعضاء والصلاحيات' : 'Members and permissions'}
              </p>
            </div>
          </div>
          <ArrowIcon className="h-4 w-4 text-muted-foreground transition group-hover:text-brand-cyan" />
        </Link>
        <Link
          href="/profile/level"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-brand-teal/40 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{isAr ? 'مستواي' : 'My Level'}</p>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? 'النقاط والشارات والتقدم' : 'Points, badges & progress'}
              </p>
            </div>
          </div>
          <ArrowIcon className="h-4 w-4 text-muted-foreground transition group-hover:text-brand-gold" />
        </Link>
      </div>

      {/* Latest activity — brief list, not full status cards */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-brand-teal">
            {isAr ? 'آخر نشاط على أفكاري' : 'Latest activity on my ideas'}
          </h3>
          {myIdeas.length > 0 && (
            <Link href="/my-ideas" className="text-xs font-medium text-brand-teal hover:underline">
              {isAr ? 'عرض الكل' : 'View all'}
            </Link>
          )}
        </div>
        {latest.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-foreground">{t('noIdeasYet')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('submitFirst')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {latest.map((idea: any) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas/${idea.id}` as any}
                  className="flex items-center justify-between gap-3 py-3 transition hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-brand-cyan">{idea.code}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(idea.created_at, locale)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                      {isAr ? idea.title_ar : idea.title_en}
                    </p>
                  </div>
                  <ArrowIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
