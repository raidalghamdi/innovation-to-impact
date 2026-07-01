import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { PublicShell } from '@/components/public-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Code2, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  const sections = [
    { slug: 'main', icon: Trophy, title: t('main.title'), desc: t('main.desc') },
    { slug: 'hackathon', icon: Code2, title: t('hackathon.title'), desc: t('hackathon.desc') },
    { slug: 'workshops', icon: GraduationCap, title: t('workshops.title'), desc: t('workshops.desc') },
  ];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.slug} className="flex flex-col">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg text-brand-teal">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                <Link
                  href={`/events/${s.slug}` as any}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal hover:gap-2"
                >
                  {t('viewSection')} <Chevron className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
