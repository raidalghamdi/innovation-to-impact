import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Card, CardContent } from '@/components/ui/card';

export default async function EvaluationCriteriaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluationCriteria');
  const criteria = t.raw('criteria') as { name: string; weight: string; desc: string }[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>

      <Card className="mt-8 overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-brand-teal-light/50 text-start">
              <tr>
                <th className="p-3 text-start font-semibold text-brand-teal">{t('criteriaHeader')}</th>
                <th className="p-3 text-start font-semibold text-brand-teal">{t('weightHeader')}</th>
                <th className="p-3 text-start font-semibold text-brand-teal">{t('descHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-brand-cyan-light px-2 py-0.5 text-xs font-semibold text-brand-teal">
                      {c.weight}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">{t('note')}</p>
    </PublicShell>
  );
}
