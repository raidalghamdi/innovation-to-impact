import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

type Milestone = { phase: string; date: string; desc: string; status: string };

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('roadmap');
  const milestones = t.raw('milestones') as Milestone[];

  const statusLabel: Record<string, string> = {
    done: t('statusDone'),
    active: t('statusActive'),
    upcoming: t('statusUpcoming'),
  };

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>

      <ol className="mt-8 space-y-0">
        {milestones.map((m, i) => {
          const Icon =
            m.status === 'done' ? CheckCircle2 : m.status === 'active' ? Loader2 : Circle;
          return (
            <li key={i} className="relative flex gap-4 pb-8 last:pb-0">
              {i < milestones.length - 1 && (
                <span className="absolute start-[15px] top-8 h-full w-px bg-border" aria-hidden />
              )}
              <div
                className={cn(
                  'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  m.status === 'done' && 'bg-emerald-100 text-emerald-700',
                  m.status === 'active' && 'bg-amber-100 text-amber-700',
                  m.status === 'upcoming' && 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-brand-teal">{m.phase}</h3>
                  <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-[11px] font-medium text-brand-teal">
                    {statusLabel[m.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{m.date}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </PublicShell>
  );
}
