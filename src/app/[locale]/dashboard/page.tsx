import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { StageTimeline } from '@/components/stage-timeline';
import { StatsBlock } from '@/components/stats-block';
import { GamificationPanel } from '@/components/gamification-panel';
import { BackToTop } from '@/components/back-to-top';
import { QuickActions } from '@/components/quick-actions';
import { DashboardRoleHeader } from '@/components/dashboard-role-header';
import { InnovatorDashboard } from '@/components/dashboards/innovator-dashboard';
import { JudgeDashboard } from '@/components/dashboards/judge-dashboard';
import { CommitteeDashboard } from '@/components/dashboards/committee-dashboard';
import { AdminDashboard } from '@/components/dashboards/admin-dashboard';
import { SupervisorDashboard } from '@/components/dashboards/supervisor-dashboard';
import { Link } from '@/i18n/routing';
import { fetchIdeas } from '@/lib/data';
import { getStats } from '@/lib/demo-data';
import { formatDate } from '@/lib/utils';
import { getCurrentUser } from '@/lib/user';
import { getMyUserRoles, isValidRoleCode } from '@/lib/db-roles';
import { loadCms, isSectionEnabled } from '@/lib/cms';
import {
  Lightbulb,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';

// src/app/[locale]/dashboard/page.tsx:25
// Phase 12.1 — dashboard root. Users who have 1+ rows in the new
// `innovation.user_roles` system (Batch B multi-role) get the new
// role-based dashboard (LandingNav + DashboardRoleHeader + role component,
// selected via the `i2i_active_role` cookie set at login/role-selection).
// Users with 0 rows there (pre-existing accounts never migrated — see
// Non-goals in the brief, backfill intentionally not run yet) fall back
// unchanged to the legacy unified dashboard below, so no existing
// functionality is removed.
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

  // Canonical role resolution (user_profiles → metadata → email).
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const role = user?.role ?? 'submitter';
  const displayName =
    user?.fullName ??
    (user?.email ? user.email.split('@')[0] : null) ??
    (locale === 'ar' ? 'زائر' : 'Guest');
  const isFirstSession = user?.isFirstSession ?? false;

  // Phase 12.1 — Batch B multi-role dashboard routing.
  const myRoles = userId ? await getMyUserRoles() : [];
  if (userId && myRoles.length > 0) {
    const cookieStore = await cookies();
    const cookieRole = cookieStore.get('i2i_active_role')?.value;
    const activeRole =
      cookieRole && myRoles.some((r) => r.role_code === cookieRole)
        ? cookieRole
        : myRoles.find((r) => r.is_primary)?.role_code ?? myRoles[0].role_code;

    // Evaluators have their own dedicated area (/evaluator) with an
    // evaluator-only landing — they must never see the innovator dashboard.
    if (activeRole === 'evaluator') {
      redirect(`/${locale}/evaluator`);
    }

    const roleOptions = myRoles.map((r) => ({
      code: r.role_code,
      name_ar: r.role_name_ar,
      name_en: r.role_name_en,
    }));

    return (
      <AppShell>
        {/* Breadcrumb + role switcher for multi-role users. The full app nav
            (logo, submit CTA, bell, language, user menu) is provided by
            AppShell so the header is identical across every authenticated
            page (fix: persistent nav everywhere). */}
        <div className="-mx-3 -mt-6 mb-6 sm:-mx-6 lg:-mx-8">
          <DashboardRoleHeader roles={roleOptions} activeRole={activeRole} displayName={displayName} />
        </div>
        {isValidRoleCode(activeRole) && activeRole === 'innovator' && (
          <InnovatorDashboard userId={userId} locale={locale} />
        )}
        {isValidRoleCode(activeRole) && activeRole === 'judge' && (
          <JudgeDashboard userId={userId} locale={locale} />
        )}
        {isValidRoleCode(activeRole) && activeRole === 'committee' && (
          <CommitteeDashboard locale={locale} />
        )}
        {isValidRoleCode(activeRole) && activeRole === 'admin' && (
          <AdminDashboard locale={locale} />
        )}
        {isValidRoleCode(activeRole) && activeRole === 'supervisor' && (
          <SupervisorDashboard userId={userId} locale={locale} />
        )}
        <BackToTop label={tc('backToTop')} />
      </AppShell>
    );
  }

  // Legacy fallback (no user_roles rows): evaluators still belong in their own
  // dedicated area, never the innovator dashboard.
  if (role === 'evaluator') {
    redirect(`/${locale}/evaluator`);
  }

  const allIdeas = await fetchIdeas();
  const myIdeas = userId
    ? allIdeas.filter((i: any) => i.submitter_id === userId).slice(0, 3)
    : [];

  // Widget visibility from CMS (admins toggle these at /admin/cms).
  const cms = await loadCms('dashboard');
  const show = (id: string) => isSectionEnabled(cms, id);

  return (
    <AppShell>
      {/* ===== Welcome strip — unified home pattern from the prototype ===== */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-teal to-brand-teal-dark p-6 text-white sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-cyan-light">
          {isFirstSession ? t('welcomeFirstTime') : t('welcomeBack')}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {isFirstSession
            ? locale === 'ar'
              ? `مرحباً، ${displayName}`
              : `Welcome, ${displayName}`
            : locale === 'ar'
              ? `أهلًا بعودتك، ${displayName}`
              : `Welcome back, ${displayName}`}
        </h1>
        <p className="mt-2 text-sm text-brand-cyan-light">{t('whatToDo')}</p>

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

      {/* ===== Quick actions — role-aware, ported from prototype's QA{} ===== */}
      {show('quick_actions') && (
        <QuickActions
          role={role}
          locale={locale}
          title={locale === 'ar' ? 'الإجراءات السريعة' : 'Quick actions'}
        />
      )}

      {/* ===== My recent ideas ===== */}
      {show('my_recent_ideas') && userId && (
        <section className="mt-8" data-widget="my_recent_ideas">
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
                    <StageTimeline current={idea.current_stage} isStopped={['returned','rejected','on_hold','withdrawn'].includes(idea.status)} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== Gamification — submitters only ===== */}
      {show('gamification') && userId && role === 'submitter' && (
        <div data-widget="gamification">
          <GamificationPanel userId={userId} locale={locale} />
        </div>
      )}

      {/* ===== Platform activity ===== */}
      {show('platform_activity') && (
        <section className="mt-10" data-widget="platform_activity">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-brand-teal">{t('platformActivity')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('platformActivityHint')}</p>
          </div>
          <StatsBlock stats={stats} locale={locale} />
        </section>
      )}

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
