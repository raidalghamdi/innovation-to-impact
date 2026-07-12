import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { KPICard } from '@/components/kpi-card';
import { Link } from '@/i18n/routing';
import { fetchActivities, fetchIdeas } from '@/lib/data';
import { Lightbulb, CheckCircle2, FlaskConical } from 'lucide-react';

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('activities');
  const [activities, ideas] = await Promise.all([fetchActivities(), fetchIdeas()]);
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const scoped = ideas.filter((i) => i.activity_id === id);
  const approved = scoped.filter((i) => ['approved', 'in_pilot', 'in_implementation', 'benefits_tracking'].includes(i.status)).length;
  const piloting = scoped.filter((i) => i.status === 'in_pilot').length;

  return (
    <AppShell>
      <PageHeader
        title={locale === 'ar' ? activity.name_ar : activity.name_en}
        subtitle={activity.type}
        action={<StatusBadge status={activity.status} locale={locale} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label={t('scoreboard')} value={scoped.length} icon={Lightbulb} />
        <KPICard label={t('approved')} value={approved} icon={CheckCircle2} accent="gold" />
        <KPICard label={t('inPilot')} value={piloting} icon={FlaskConical} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-teal">{t('scoreboard')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scoped.map((i, rank) => (
            <Link
              key={i.id}
              href={`/ideas/${i.id}`}
              className="flex items-center gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted/50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-teal-light text-xs font-semibold text-brand-teal">
                {rank + 1}
              </span>
              <span className="flex-1 line-clamp-1">{locale === 'ar' ? i.title_ar : i.title_en}</span>
              <StatusBadge status={i.status} locale={locale} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
