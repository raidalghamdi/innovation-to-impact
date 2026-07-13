import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { CriteriaEditor } from '@/components/admin/criteria-editor';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';
import { listCommitteeCriteria } from '@/lib/committee-criteria';

// /admin/committee-criteria (R43) — admin OR supervisor may manage the
// weighted, bilingual committee scoring criteria.
export default async function CommitteeCriteriaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const isSupervisor = await userHasRole(user.id, 'supervisor');
  const allowed = isSupervisor || user.role === 'admin';
  if (!allowed) redirect(`/${locale}/dashboard`);

  const criteria = await listCommitteeCriteria(false);
  const t = await getTranslations('admin.criteria');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CriteriaEditor initial={criteria} />
    </AppShell>
  );
}
