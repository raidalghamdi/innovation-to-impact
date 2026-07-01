import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

async function fetchAudit(): Promise<AuditRow[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data as AuditRow[]) ?? [];
  } catch {
    return [];
  }
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('audit');
  const rows = await fetchAudit();

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-brand-teal-light/50">
                <tr>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('when')}</th>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('actor')}</th>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('action')}</th>
                  <th className="p-3 text-start font-semibold text-brand-teal">{t('entity')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground" dir="ltr">{r.created_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td className="p-3 font-mono text-xs">{r.actor_id?.slice(0, 8) ?? '—'}</td>
                    <td className="p-3">{r.action}</td>
                    <td className="p-3 text-muted-foreground">{r.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
