import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const SECTIONS = ['main', 'hackathon', 'workshops'] as const;

export function generateStaticParams() {
  return SECTIONS.flatMap((section) =>
    ['ar', 'en'].map((locale) => ({ locale, section }))
  );
}

export default async function EventSectionPage({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  if (!SECTIONS.includes(section as any)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('events');

  const title = t(`${section}.title` as any);
  const desc = t(`${section}.desc` as any);
  const items =
    section === 'workshops'
      ? (t.raw('workshops.items') as { name: string; date: string }[])
      : [];

  return (
    <PublicShell
      locale={locale}
      breadcrumbs={[{ href: '/events', label: t('title') }, { label: title }]}
    >
      <h1 className="text-3xl font-bold text-brand-teal">{title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{desc}</p>

      {items.length > 0 && (
        <div className="mt-8 space-y-3">
          {items.map((w, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{w.name}</span>
                </div>
                <span className="text-xs text-muted-foreground" dir="ltr">{w.date}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
