import { setRequestLocale } from 'next-intl/server';
import { LandingNav } from '@/components/landing-nav';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

// src/app/[locale]/forgot-password/page.tsx:1
export default async function ForgotPasswordPage({
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
        <ForgotPasswordForm />
      </main>
    </div>
  );
}
