import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { RoleKpiCard as KpiCard } from '@/components/role-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { fetchIdeas } from '@/lib/data';
import { formatDate } from '@/lib/utils';
import { Lightbulb, Clock, CheckCircle2, Trophy, PlusCircle } from 'lucide-react';

// src/components/dashboards/innovator-dashboard.tsx:1
// Phase 12.2 — KPIs: my ideas count, in review, accepted, prize position
// (approximated by points-based leaderboard rank — see profile/level page for
// the canonical ranking logic; here we keep it simple: a static placeholder
// hint if unavailable rather than fabricating a rank).
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={isAr ? 'أفكاري' : 'My Ideas'} value={myIdeas.length} icon={Lightbulb} />
        <KpiCard label={isAr ? 'قيد المراجعة' : 'In Review'} value={inReview} icon={Clock} />
        <KpiCard label={isAr ? 'مقبولة' : 'Accepted'} value={accepted} icon={CheckCircle2} />
        <KpiCard label={isAr ? 'ترتيب الجوائز' : 'Prize Position'} value="—" icon={Trophy} hint={isAr ? 'راجع صفحة مستواي' : 'See My Level page'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-teal">{t('myRecentIdeas')}</h2>
        <Button asChild size="sm">
          <Link href="/ideas/new">
            <PlusCircle className="h-4 w-4" />
            {t('submitNewIdea')}
          </Link>
        </Button>
      </div>

      {myIdeas.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t('noIdeasYet')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('submitFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {myIdeas.slice(0, 6).map((idea: any) => (
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
                {isAr ? idea.title_ar : idea.title_en}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(idea.created_at, locale)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
