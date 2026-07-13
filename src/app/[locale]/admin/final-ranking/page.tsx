import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { FinalRankingControl } from '@/components/admin/final-ranking-control';
import { getCurrentUser } from '@/lib/user';

// /admin/final-ranking (R43) — admin only. Preview + run the final Top-N
// ranking that approves the top ideas and marks the rest not_selected.
export default async function FinalRankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations('admin.finalRanking');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <FinalRankingControl />
    </AppShell>
  );
}
