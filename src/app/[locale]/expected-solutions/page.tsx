import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { loadCms, getText, isSectionEnabled } from '@/lib/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

export default async function ExpectedSolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('expectedSolutions');
  const cms = await loadCms('expected_solutions');
  const categories = t.raw('categories') as { title: string; items: string[] }[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      {isSectionEnabled(cms, 'intro') && (
        <>
          <h1 className="text-3xl font-bold text-brand-teal">{getText(cms, 'intro', 'title', locale, t('title'))}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{getText(cms, 'intro', 'body', locale, t('subtitle'))}</p>
        </>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {categories.map((cat, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-lg text-brand-teal">{cat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {cat.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicShell>
  );
}
