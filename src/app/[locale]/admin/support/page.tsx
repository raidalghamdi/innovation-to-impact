import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/user';
import { isCurrentUserAdmin } from '@/lib/db-roles';
import { createClient } from '@/lib/supabase/server';
import { SupportHandledButton } from '@/components/support-handled-button';
import { ExportBar } from '@/components/exports/ExportBar';

export const dynamic = 'force-dynamic';

// /admin/support — Support Inbox (Missing 7.2). Read model over
// innovation.support_messages: newest first, showing sender + a short body
// preview and whether each message has been handled. Column names are read
// defensively (sender_name || name, sender_email || email, message || body)
// so the inbox works regardless of the exact table shape.

type SupportMessage = {
  id: string;
  created_at: string | null;
  sender_name?: string | null;
  name?: string | null;
  sender_email?: string | null;
  email?: string | null;
  subject: string | null;
  body?: string | null;
  message?: string | null;
  handled_at: string | null;
};

function preview(text: string | null | undefined, max = 120): string {
  const s = (text ?? '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

async function fetchSupportMessages(): Promise<SupportMessage[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fetchSupportMessages] supabase error:', error);
    return [];
  }
  return (data as SupportMessage[] | null) ?? [];
}

export default async function AdminSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin(user.role))) {
    redirect(`/${locale}/dashboard`);
  }

  const messages = await fetchSupportMessages();

  return (
    <AppShell>
      <PageHeader
        title={isAr ? 'صندوق الدعم' : 'Support Inbox'}
        subtitle={
          isAr
            ? 'الرسائل الواردة من نموذج الدعم، الأحدث أولاً. ضع علامة على الرسائل التي عالجتها.'
            : 'Messages from the support form, newest first. Mark the ones you have handled.'
        }
        action={<ExportBar screenId="admin.support" sensitive={false} />}
      />

      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-0">
          {messages.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {isAr ? 'لا توجد رسائل دعم.' : 'No support messages.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-teal-light/50">
                  <tr>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'التاريخ' : 'Received'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'المرسِل' : 'Sender'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'البريد' : 'Email'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'الموضوع' : 'Subject'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'المحتوى' : 'Message'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'الحالة' : 'Status'}
                    </th>
                    <th className="p-3 text-start font-semibold text-brand-teal">
                      {isAr ? 'إجراء' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => {
                    const handled = Boolean(m.handled_at);
                    return (
                      <tr key={m.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap p-3 text-muted-foreground" dir="ltr">
                          {formatDate(m.created_at, locale)}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {m.sender_name || m.name || '—'}
                        </td>
                        <td className="p-3 text-muted-foreground" dir="ltr">
                          {m.sender_email || m.email || '—'}
                        </td>
                        <td className="p-3 text-foreground">{m.subject || '—'}</td>
                        <td className="max-w-xs p-3 text-muted-foreground">
                          {preview(m.body ?? m.message)}
                        </td>
                        <td className="p-3">
                          {handled ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              {isAr ? 'مُعالَج' : 'Handled'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {isAr ? 'جديد' : 'New'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {handled ? (
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {formatDate(m.handled_at, locale)}
                            </span>
                          ) : (
                            <SupportHandledButton id={m.id} locale={locale} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
