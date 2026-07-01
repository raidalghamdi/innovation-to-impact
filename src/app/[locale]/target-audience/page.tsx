import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { loadCms, getText, isSectionEnabled } from '@/lib/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, Building2, GraduationCap } from 'lucide-react';

const ICONS = [Rocket, Building2, GraduationCap];

export default async function TargetAudiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('targetAudience');
  const cms = await loadCms('target_audience');
  const cards = t.raw('cards') as { title: string; body: string }[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      {isSectionEnabled(cms, 'intro') && (
        <>
          <h1 className="text-3xl font-bold text-brand-teal">{getText(cms, 'intro', 'title', locale, t('title'))}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{getText(cms, 'intro', 'body', locale, t('subtitle'))}</p>
        </>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Card key={i}>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg text-brand-teal">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
