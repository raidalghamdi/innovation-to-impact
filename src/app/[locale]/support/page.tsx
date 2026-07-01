import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { SupportForm } from '@/components/support-form';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, Clock } from 'lucide-react';

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('support');
  const tf = await getTranslations('footer');

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <SupportForm />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-sm font-semibold text-brand-teal">{t('contactTitle')}</h2>
              <p className="flex items-center gap-2 text-sm text-muted-foreground" dir="ltr">
                <Mail className="h-4 w-4 text-brand-teal" /> {tf('contactEmail')}
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground" dir="ltr">
                <Phone className="h-4 w-4 text-brand-teal" /> +966 11 000 0000
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-brand-teal" /> {t('hours')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
