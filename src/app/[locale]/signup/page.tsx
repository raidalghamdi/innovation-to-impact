import { redirect } from 'next/navigation';

// src/app/[locale]/signup/page.tsx
// The signup entry is unified into the email-first /login flow.
// AuthForm now detects account state (login / activate / signup / closed)
// automatically after the user enters their email, so this route just
// redirects to /login to avoid duplicating UI.
export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/login`);
}
