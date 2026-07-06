import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth-form';
import { LandingNav } from '@/components/landing-nav';
import { getPlatformSetting } from '@/lib/db-roles';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/logo';

// src/app/[locale]/signup/page.tsx:1
// Phase 10.4 — external self-registration is gated by
// innovation.platform_settings.external_registration_enabled (DB-driven, no
// Vercel env var). Internal (@gac.gov.sa) users never self-register — they
// are imported by an admin (see /admin/employees/import).
export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  const enabled = await getPlatformSetting<boolean>('external_registration_enabled', false);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav locale={locale} />
      <main>
        {enabled ? (
          <AuthForm mode="signup" />
        ) : (
          <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <span className="text-brand-teal">
                  <Logo className="h-12 w-12" />
                </span>
                <h1 className="text-lg font-semibold text-foreground">{t('registrationClosedTitle')}</h1>
                <p className="text-sm text-muted-foreground">{t('registrationClosedBody')}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
