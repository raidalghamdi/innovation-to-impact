import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { TermsEditor } from '@/components/terms-editor';

export const dynamic = 'force-dynamic';

// /admin/terms — edit the public Terms & Conditions content (one row per locale
// in innovation.terms_content). Admin-only.
export default async function AdminTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('adminTerms');
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const admin = createAdminClient();
  let initialAr = '';
  let initialEn = '';
  if (admin) {
    const { data } = await admin
      .from('terms_content')
      .select('locale, content');
    for (const row of (data as { locale: string; content: string }[]) ?? []) {
      if (row.locale === 'ar') initialAr = row.content ?? '';
      if (row.locale === 'en') initialEn = row.content ?? '';
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="mt-6">
        <TermsEditor locale={locale} initialAr={initialAr} initialEn={initialEn} />
      </div>
    </AppShell>
  );
}
