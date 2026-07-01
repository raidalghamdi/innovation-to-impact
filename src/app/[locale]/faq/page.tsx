import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { ChevronDown } from 'lucide-react';

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('faq');
  const items = t.raw('items') as { q: string; a: string }[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((it, i) => (
          <details key={i} className="group px-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <span>{it.q}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-brand-teal transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
          </details>
        ))}
      </div>
    </PublicShell>
  );
}
