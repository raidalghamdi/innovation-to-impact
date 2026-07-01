import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');
  const body = t.raw('body') as string[];

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('updated')}: {new Date().toISOString().slice(0, 10)}
      </p>
      <div className="mt-6 max-w-3xl space-y-4">
        {body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
        ))}
      </div>
    </PublicShell>
  );
}
