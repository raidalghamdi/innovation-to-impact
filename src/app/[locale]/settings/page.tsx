import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/language-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignOutButton } from '@/components/sign-out-button';
import { createClient } from '@/lib/supabase/server';
import { roleFromEmail, isRole, type Role } from '@/lib/roles';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  // Read actual session user from Supabase so this page reflects who is
  // logged in — previously the fields were hard-coded placeholders which
  // misled QA into thinking a session-mismatch bug existed.
  let fullName = '';
  let email = '';
  let role: Role | '' = '';

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user) {
      email = user.email ?? '';
      role = isRole(user.user_metadata?.role)
        ? (user.user_metadata!.role as Role)
        : roleFromEmail(user.email);
      // Prefer the profile row for a localized display name.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, full_name_ar')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        fullName =
          (locale === 'ar' ? profile.full_name_ar : profile.full_name) ||
          profile.full_name ||
          profile.full_name_ar ||
          '';
      }
      if (!fullName) {
        fullName =
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          email;
      }
    }
  }

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
              <Input id="settings-full-name" defaultValue={fullName} dir="auto" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">{t('email')}</Label>
              <Input id="settings-email" defaultValue={email} dir="ltr" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-role">{t('role')}</Label>
              <Input id="settings-role" defaultValue={role} readOnly />
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-brand-teal">{t('session')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SignOutButton variant="text" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
