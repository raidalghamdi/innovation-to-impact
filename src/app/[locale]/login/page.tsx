import { setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/auth-form';
import { LandingNav } from '@/components/landing-nav';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-background">
      <LandingNav locale={locale} />
      <main>
        <AuthForm mode="login" />
      </main>
    </div>
  );
}
