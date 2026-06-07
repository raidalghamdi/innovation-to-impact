import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { fetchThemes } from '@/lib/data';
import { userName } from '@/lib/demo-data';
import { Target } from 'lucide-react';

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('strategy');
  const themes = await fetchThemes();

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <h2 className="section-title mb-4">{t('themes')}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {themes.map((th) => (
          <Card key={th.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-teal-light text-brand-teal">
                  <Target className="h-5 w-5" />
                </div>
                <span className="rounded bg-brand-gold-light px-2 py-0.5 text-xs font-medium text-brand-gold">
                  {t('priority')} {th.priority}
                </span>
              </div>
              <p className="font-semibold text-foreground">
                {locale === 'ar' ? th.name_ar : th.name_en}
              </p>
              <p className="text-sm text-muted-foreground">{th.description}</p>
              <p className="text-xs text-muted-foreground">
                {t('owner')}: {userName(th.owner_id)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
