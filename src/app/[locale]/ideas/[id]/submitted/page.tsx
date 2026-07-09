import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { fetchIdeas } from '@/lib/data';
import { ideas as demoIdeas } from '@/lib/demo-data';
import { CheckCircle2, ClipboardCheck, Users, Mail, ArrowRight, LayoutDashboard } from 'lucide-react';

export default async function IdeaSubmittedPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ideaSubmitted');

  // Resolve the submitted idea's title (best-effort; falls back gracefully).
  const allIdeas = await fetchIdeas();
  const idea =
    allIdeas.find((i) => i.id === id) ?? demoIdeas.find((i) => i.id === id) ?? null;
  const isAr = locale === 'ar';
  const title = idea ? (isAr ? idea.title_ar : idea.title_en) || idea.title_en || idea.title_ar || '' : '';
  const code = idea?.code ?? '';

  const steps = [
    {
      icon: ClipboardCheck,
      title: t('step1Title'),
      meta: t('step1Meta'),
      body: t('step1Body'),
    },
    {
      icon: Users,
      title: t('step2Title'),
      meta: t('step2Meta'),
      body: t('step2Body'),
    },
    {
      icon: Mail,
      title: t('step3Title'),
      meta: t('step3Meta'),
      body: t('step3Body'),
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Success hero */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/10 ring-4 ring-brand-teal/20"
            aria-hidden="true"
          >
            <CheckCircle2 className="h-10 w-10 text-brand-teal" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold text-brand-teal sm:text-3xl">
            {t('headline')}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('subhead')}</p>
        </div>

        {/* Submitted idea recap */}
        {(title || code) && (
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('yourIdeaLabel')}
              </div>
              <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p
                  className="text-base font-semibold text-foreground sm:text-lg"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {title || '—'}
                </p>
                {code && (
                  <span className="shrink-0 rounded-full bg-brand-teal-light px-2.5 py-0.5 text-xs font-medium text-brand-teal">
                    {t('referenceLabel')} · {code}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="mb-6">
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-teal">
              {t('whatHappensNext')}
            </h2>
            <ol className="relative space-y-6">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const isLast = i === steps.length - 1;
                return (
                  <li key={i} className="relative flex gap-4">
                    {/* Connector line (vertical) — hidden for last step */}
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className="absolute top-10 h-[calc(100%-1rem)] w-px bg-border ltr:left-5 rtl:right-5"
                      />
                    )}
                    <div
                      className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white ring-4 ring-background"
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{s.title}</p>
                        <p className="text-xs font-medium text-brand-teal">{s.meta}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="flex flex-col gap-3 md:flex-row md:justify-center">
          <Button asChild size="lg">
            <Link href="/my-ideas">
              {t('trackCta')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              {t('myDashboardCta')}
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
