import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { CmsWorkspace } from '@/components/cms-workspace';

export default async function CmsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('cms');

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {locale === 'ar'
          ? 'حرر أي نص أو وسائط (صور/فيديو) على الموقع، وأخفِ/أظهر أي قسم. التغييرات تظهر مباشرة بعد الحفظ.'
          : 'Edit any text or media (images/videos) on the site, and toggle sections on/off. Changes go live immediately after save.'}
      </p>
      <div className="mt-6">
        <CmsWorkspace locale={locale} />
      </div>
    </AppShell>
  );
}
