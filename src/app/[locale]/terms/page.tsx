import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/public-shell';
import { TermsContent } from '@/components/terms-content';
import { createClient } from '@/lib/supabase/server';

// Terms content is admin-editable (innovation.terms_content). Revalidate on a
// short interval; the admin save route also revalidates this path on demand.
export const revalidate = 60;

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('terms');

  // Prefer the admin-managed content from the DB; fall back to the bundled
  // translation body when Supabase is unconfigured or the row is missing.
  let content: string | null = null;
  let updatedAt: string | null = null;
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase
      .from('terms_content')
      .select('content, updated_at')
      .eq('locale', locale)
      .maybeSingle();
    content = (data as { content?: string } | null)?.content ?? null;
    updatedAt = (data as { updated_at?: string } | null)?.updated_at ?? null;
  }

  const isAr = locale === 'ar';
  const fallbackBody = t.raw('body') as string[];
  const updatedLabel = (updatedAt ?? new Date().toISOString()).slice(0, 10);

  return (
    <PublicShell locale={locale} breadcrumbs={[{ label: t('title') }]}>
      <h1 className="text-3xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('updated')}: {updatedLabel}
      </p>
      <div className="mt-6">
        {content ? (
          <TermsContent content={content} dir={isAr ? 'rtl' : 'ltr'} />
        ) : (
          <div className="max-w-3xl space-y-4">
            {fallbackBody.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
