import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Link } from '@/i18n/routing';
import { fetchActivities, fetchIdeas } from '@/lib/data';
import { formatDate } from '@/lib/utils';
import { Calendar } from 'lucide-react';

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('activities');
  const tc = await getTranslations('common');
  const [activities, ideas] = await Promise.all([fetchActivities(), fetchIdeas()]);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {activities.map((a) => {
          const count = ideas.filter((i) => i.activity_id === a.id).length;
          return (
            <Link key={a.id} href={`/activities/${a.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-teal-light text-brand-teal">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <StatusBadge status={a.status} locale={locale} />
                  </div>
                  <p className="font-semibold text-foreground">
                    {locale === 'ar' ? a.name_ar : a.name_en}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-brand-gold">{a.type}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{a.target_audience}</span>
                    <span>{count} {tc('total')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('period')}: {formatDate(a.start_date, locale)} — {a.end_date ? formatDate(a.end_date, locale) : '…'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
