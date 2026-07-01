import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadCms, getText, isSectionEnabled } from '@/lib/cms';

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const sections = t.raw('sections') as { title: string; body: string }[];
  const cms = await loadCms('about');

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      {isSectionEnabled(cms, 'intro') && (
        <>
          <h1 className="text-3xl font-bold text-brand-teal">{getText(cms, 'intro', 'title', locale, t('title'))}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{getText(cms, 'intro', 'body', locale, t('subtitle'))}</p>
        </>
      )}
      {isSectionEnabled(cms, 'mission') && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {sections.map((s, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-lg text-brand-teal">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
