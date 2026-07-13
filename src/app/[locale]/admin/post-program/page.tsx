import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { PostProgramDashboard } from '@/components/admin/post-program-dashboard';
import { getCurrentUser } from '@/lib/user';
import { createClient } from '@/lib/supabase/server';

// /admin/post-program (R43) — admin only. Manually walk approved ideas through
// the post-program lifecycle (pilot -> measurement -> scaling).
export default async function PostProgramPage({
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

  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from('ideas')
        .select('id, code, title_ar, title_en, status')
        .in('status', ['approved', 'in_pilot', 'in_measurement', 'in_scaling'])
        .order('code', { ascending: true })
    : { data: [] as Array<{ id: string; code: string | null; title_ar: string | null; title_en: string | null; status: string }> };

  const ideas = (
    (data as Array<{
      id: string;
      code: string | null;
      title_ar: string | null;
      title_en: string | null;
      status: string;
    }> | null) ?? []
  );

  const t = await getTranslations('admin.postProgram');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PostProgramDashboard ideas={ideas} />
    </AppShell>
  );
}
