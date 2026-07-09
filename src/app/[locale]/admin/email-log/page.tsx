import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * /admin/email-log — admin-only viewer for innovation.email_log.
 *
 * Lists the last 100 send attempts (newest first) recorded by lib/mailer.ts.
 * Access is gated to admins; the underlying table also enforces RLS so a
 * non-admin who reached the data another way still gets nothing.
 */

type EmailLogRow = {
  id: string;
  created_at: string | null;
  to_original: string | null;
  to_final: string | null;
  subject: string | null;
  provider: string | null;
  status: string | null;
  error: string | null;
  redirect_applied: boolean | null;
};

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}

const STATUS_TONE: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  noop: 'bg-slate-100 text-slate-600',
};

export default async function EmailLogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('emailLog');

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect(`/${locale}?toast=email_log.forbidden`);
  }

  const admin = createAdminClient();
  let rows: EmailLogRow[] = [];
  if (admin) {
    const { data } = await admin
      .from('email_log')
      .select(
        'id, created_at, to_original, to_final, subject, provider, status, error, redirect_applied'
      )
      .order('created_at', { ascending: false })
      .limit(100);
    rows = (data as EmailLogRow[] | null) ?? [];
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-teal">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colWhen')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colToOriginal')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colToFinal')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colSubject')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colProvider')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colStatus')}</th>
                    <th className="p-3 text-start font-semibold text-brand-teal">{t('colError')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap p-3 text-muted-foreground" dir="ltr">
                        {formatDateTime(r.created_at, locale)}
                      </td>
                      <td className="p-3" dir="ltr">
                        <span className="flex items-center gap-1.5">
                          <span className="break-all">{r.to_original ?? '—'}</span>
                          {r.redirect_applied && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-brand-teal/15 px-2 py-0.5 text-[10px] font-medium text-brand-teal">
                              {t('redirected')}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3 break-all" dir="ltr">{r.to_final ?? '—'}</td>
                      <td className="p-3">{r.subject ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">{r.provider ?? '—'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_TONE[r.status ?? ''] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.status ?? '—'}
                        </span>
                      </td>
                      <td className="max-w-[240px] p-3 text-xs text-red-700" title={r.error ?? undefined}>
                        {r.error ? r.error.slice(0, 200) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
