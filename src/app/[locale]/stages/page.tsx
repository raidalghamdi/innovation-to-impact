import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackToTop } from '@/components/back-to-top';
import { Link } from '@/i18n/routing';
import {
  Target,
  Inbox,
  Calendar,
  Filter,
  ClipboardCheck,
  UserCheck,
  FlaskConical,
  Rocket,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';

const STAGE_ICONS = [
  Target,
  Inbox,
  Calendar,
  Filter,
  ClipboardCheck,
  UserCheck,
  FlaskConical,
  Rocket,
  TrendingUp,
];

export default async function StagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('stagesPage');
  const tStages = await getTranslations('stages');
  const tc = await getTranslations('common');
  const tLanding = await getTranslations('landing');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  const stages = Array.from({ length: 9 }, (_, i) => i);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <ol className="space-y-4">
        {stages.map((i) => {
          const Icon = STAGE_ICONS[i];
          return (
            <li key={i} className="relative">
              <Card className="overflow-hidden border-l-4 border-l-brand-teal">
                <CardContent className="grid gap-5 p-6 sm:grid-cols-[auto_1fr]">
                  {/* Stage number + icon */}
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('stageLabel')}
                      </p>
                      <p className="text-2xl font-bold text-brand-teal">{i}</p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {tStages(`s${i}` as any)}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-brand-cyan-light px-2.5 py-1 font-medium text-brand-teal">
                          {tStages('stageOwner')}: {t(`owners.s${i}` as any)}
                        </span>
                      </div>
                    </div>

                    {/* Two-column: What happens / What you need */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-brand-teal">
                          {tStages('whatHappens')}
                        </p>
                        <p className="text-sm leading-relaxed text-foreground/85">
                          {tStages(`d${i}` as any)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-brand-teal-light/50 p-4">
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-brand-teal">
                          {tStages('whatYouNeed')}
                        </p>
                        <p className="text-sm leading-relaxed text-foreground/85">
                          {tStages(`you${i}` as any)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/ideas?stage=${i}` as any}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
                    >
                      <span>{t('viewIdeasInStage')}</span>
                      <Chevron className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Vertical connector between stages */}
              {i < stages.length - 1 && (
                <div className="my-1 flex justify-center">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-cyan text-white shadow">
                    <ArrowRight className="h-3.5 w-3.5 rotate-90" />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Final CTA */}
      <section className="mt-10 rounded-3xl border border-brand-cyan/20 bg-gradient-to-br from-brand-teal-light/40 to-brand-cyan-light/40 p-6 text-center sm:p-8">
        <h3 className="text-xl font-bold text-brand-teal sm:text-2xl">
          {tLanding('finalCtaTitle')}
        </h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          {tLanding('finalCtaSubtitle')}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/ideas/new">
              <Lightbulb className="h-4 w-4" />
              {tLanding('ctaIHaveIdea')}
            </Link>
          </Button>
        </div>
      </section>

      <BackToTop label={tc('backToTop')} />
    </AppShell>
  );
}
