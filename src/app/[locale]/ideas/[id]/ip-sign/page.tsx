import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { fetchIdeas } from '@/lib/data';
import { ideas as demoIdeas } from '@/lib/demo-data';
import { FileText, ShieldCheck } from 'lucide-react';
import { SignIpTermsButton } from './sign-button';

export default async function IpSignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ipSign');
  const isAr = locale === 'ar';

  const allIdeas = await fetchIdeas();
  const idea = allIdeas.find((i) => i.id === id) ?? demoIdeas.find((i) => i.id === id) ?? null;
  if (!idea) notFound();

  const user = await getCurrentUser();

  let alreadySigned = false;
  if (user) {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase
        .from('ip_signatures')
        .select('id')
        .eq('idea_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      alreadySigned = Boolean(data);
    }
  }

  const title = isAr ? idea.title_ar : idea.title_en || idea.title_ar;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/10 ring-4 ring-brand-teal/20"
            aria-hidden="true"
          >
            <ShieldCheck className="h-9 w-9 text-brand-teal" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold text-brand-teal sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('body')}</p>
        </div>

        {title && (
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {idea.code}
              </div>
              <p className="mt-1 text-base font-semibold text-foreground" dir={isAr ? 'rtl' : 'ltr'}>
                {title}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col items-center gap-5 p-6 text-center">
            <Link
              href="/ip-terms"
              target="_blank"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-teal hover:underline"
            >
              <FileText className="h-4 w-4" />
              {t('linkLabel')}
            </Link>

            <SignIpTermsButton
              ideaId={id}
              alreadySigned={alreadySigned}
              signButtonLabel={t('signButton')}
              signedConfirmLabel={t('signedConfirm')}
              alreadySignedLabel={t('alreadySigned')}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
