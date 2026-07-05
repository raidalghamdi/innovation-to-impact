import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { PageHeader } from '@/components/page-header';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { GamificationPanel } from '@/components/gamification-panel';
import { getCurrentUser } from '@/lib/user';
import { Sparkles } from 'lucide-react';

export default async function ProfileLevelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('profileLevel');

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  const actions = t.raw('actionsList') as string[];

  return (
    <AppShell>
      <PageHeader title={t('title')} />

      <Card className="mb-6">
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-teal">
            <Sparkles className="h-4 w-4" />
            {t('howToLevelUp')}
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal"
                  aria-hidden="true"
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <GamificationPanel userId={user.id} locale={locale} />
    </AppShell>
  );
}
