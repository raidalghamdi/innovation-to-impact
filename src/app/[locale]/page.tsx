import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/logo';
import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { getStats } from '@/lib/demo-data';
import { fetchActivities } from '@/lib/data';
import { formatSAR } from '@/lib/utils';
import {
  Lightbulb,
  GitBranch,
  FlaskConical,
  TrendingUp,
  ArrowRight,
  Target,
  ClipboardCheck,
  Rocket,
} from 'lucide-react';

const STAGE_ICONS = [Target, Lightbulb, ClipboardCheck, GitBranch, Rocket, TrendingUp, FlaskConical, Rocket, TrendingUp];

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const stats = getStats();
  const activities = await fetchActivities();
  const stageKeys = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="text-brand-teal">
            <Logo className="h-8 w-8" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-brand-teal">{t('app.name')}</span>
            <span className="text-[11px] text-muted-foreground">{t('app.owner')}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t('nav.login')}</Link>
          </Button>
          <LanguageToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-brand-teal text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <p className="mb-3 text-sm font-medium text-brand-gold">{t('app.owner')}</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85">
            {t('landing.heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg">
              <Link href="/ideas/new">
                {t('landing.ctaSubmit')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              <Link href="/ideas">{t('landing.ctaExplore')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <h2 className="section-title mb-5">{t('landing.statsTitle')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard label={t('landing.statIdeas')} value={stats.total} icon={Lightbulb} />
          <KPICard label={t('landing.statPipeline')} value={stats.inPipeline} icon={GitBranch} />
          <KPICard label={t('landing.statPilots')} value={stats.inPilot} icon={FlaskConical} />
          <KPICard
            label={t('landing.statBenefits')}
            value={formatSAR(stats.realizedBenefits, locale)}
            icon={TrendingUp}
            accent="gold"
          />
        </div>
      </section>

      {/* Stages */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <h2 className="section-title">{t('landing.stagesTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('landing.stagesSubtitle')}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stageKeys.map((key, i) => {
              const Icon = STAGE_ICONS[i];
              return (
                <div key={key} className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-teal-light text-brand-teal">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-brand-gold">{String(i)}</p>
                    <p className="text-sm font-medium text-foreground">{t(`stages.${key}`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Active programs */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <h2 className="section-title mb-5">{t('landing.recentActivities')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activities.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="font-medium text-foreground">
                    {locale === 'ar' ? a.name_ar : a.name_en}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.target_audience}</p>
                </div>
                <StatusBadge status={a.status} locale={locale} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} {t('app.owner')} · {t('app.name')}
        </div>
      </footer>
    </div>
  );
}
