import { setRequestLocale } from 'next-intl/server';
import { LandingNav } from '@/components/landing-nav';
import { OtpVerifyForm } from '@/components/otp-verify-form';

// src/app/[locale]/login/verify/page.tsx:1
export default async function LoginVerifyPage({
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
        <OtpVerifyForm mode="login" />
      </main>
    </div>
  );
}
