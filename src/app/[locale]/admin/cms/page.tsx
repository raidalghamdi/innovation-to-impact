import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { FileText } from 'lucide-react';

type CmsRow = { id: string; slug: string; title: string | null; updated_at: string };

// Content blocks the platform can surface from cms_content once migrated. Shown
// here so admins have a single place to see/edit CMS-driven copy.
const KNOWN_SLUGS = [
  'landing_hero',
  'countdown_window',
  'roadmap',
  'partners',
  'events_main',
  'events_hackathon',
  'events_workshops',
];

async function fetchCms(): Promise<CmsRow[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data } = await supabase.from('cms_content').select('id, slug, title, updated_at');
    return (data as CmsRow[]) ?? [];
  } catch {
    return [];
  }
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('cms');
  const rows = await fetchCms();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      {rows.length === 0 && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t('empty')}</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {KNOWN_SLUGS.map((slug) => {
          const row = bySlug.get(slug);
          return (
            <Card key={slug}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{slug}</p>
                    <p className="text-xs text-muted-foreground">
                      {row ? `${t('updatedAt')}: ${row.updated_at?.slice(0, 10)}` : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
