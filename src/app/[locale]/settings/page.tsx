import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/language-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('profile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-full-name">{t('fullName')}</Label>
              <Input id="settings-full-name" defaultValue="رائد الغامدي" dir="auto" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">{t('email')}</Label>
              <Input id="settings-email" defaultValue="raid.alghamdi@gac.gov.sa" dir="ltr" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-role">{t('role')}</Label>
              <Input id="settings-role" defaultValue="admin" readOnly />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('language')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('languagePref')}</p>
            <LanguageToggle />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
