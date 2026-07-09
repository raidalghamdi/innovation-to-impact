import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Globe } from 'lucide-react';
import { LanguageToggle } from '@/components/language-toggle';

export default async function EvaluatorSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('evaluator');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--ink)]">{t('navSettings')}</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('settingsSubtitle')}</p>
      </div>

      {/* Only preferences that actually exist on user_profiles are exposed.
          Language is the sole persisted preference today, so it is the only
          toggle rendered — no fabricated email/sound switches. */}
      <div className="ev-card divide-y divide-[var(--line)]">
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--gold-soft)] text-[var(--gold-deep)]">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-[var(--ink)]">{t('settingLanguage')}</p>
              <p className="text-sm text-[var(--ink-faint)]">{t('settingLanguageHint')}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
