import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LandingNav } from '@/components/landing-nav';
import { RoleSelectClient } from '@/components/role-select-client';
import { getMyUserRoles } from '@/lib/db-roles';
import { getCurrentUser } from '@/lib/user';

// src/app/[locale]/select-role/page.tsx:1
// Phase 11.1 — shown after OTP verification when the user holds 2+ roles.
export default async function SelectRolePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('roles');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const roles = await getMyUserRoles();
  if (roles.length <= 1) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNav locale={locale} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-teal sm:text-3xl">{t('selectRoleTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('selectRoleSubtitle')}</p>
        </div>
        <RoleSelectClient
          locale={locale}
          roles={roles.map((r) => ({
            code: r.role_code,
            name_ar: r.role_name_ar,
            name_en: r.role_name_en,
          }))}
        />
      </main>
    </div>
  );
}
