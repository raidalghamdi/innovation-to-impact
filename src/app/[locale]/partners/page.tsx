import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Card } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('partners');
  const partners = t.raw('partners') as { name: string }[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {partners.map((p, i) => (
          <Card
            key={i}
            className="flex flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:border-brand-teal/40"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
              <Building2 className="h-7 w-7" />
            </div>
            <span className="text-sm font-medium text-foreground">{p.name}</span>
          </Card>
        ))}
      </div>
    </PublicShell>
  );
}
