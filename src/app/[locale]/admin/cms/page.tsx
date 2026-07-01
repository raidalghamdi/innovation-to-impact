import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { CmsEditor } from '@/components/cms-editor';

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
          ? 'حرر أي نص على الموقع أو أخفِ/أظهر أي قسم. التغييرات تظهر مباشرة بعد الحفظ.'
          : 'Edit any text on the site or toggle any section on/off. Changes go live immediately after save.'}
      </p>
      <div className="mt-6">
        <CmsEditor locale={locale} />
      </div>
    </AppShell>
  );
}
