import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, FileText } from 'lucide-react';

type TermSection = { heading: string; body: string };

export default async function IpTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ip.terms');

  const sections = (t.raw('sections') as TermSection[]) ?? [];

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="mb-6">
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 text-brand-teal" />
          <span>
            {t('lastUpdated')}: <span className="font-medium text-foreground">{t('date')}</span>
          </span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <Card key={idx}>
            <CardContent className="space-y-2 p-6">
              <h2 className="text-base font-semibold text-brand-teal">{section.heading}</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{section.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-brand-teal/30 bg-brand-teal-light">
        <CardContent className="flex items-start gap-3 p-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" />
          <p className="text-sm font-medium text-brand-teal">{t('agreementNote')}</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
