'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { normalizeNotificationLink } from '@/lib/notification-link';
import { useNotificationsStream, type RealtimeNotification } from '@/lib/realtime/use-notifications-stream';
import { useToastStack, ToastStack } from '@/components/ui/toast';
import { Bell } from 'lucide-react';

type Notif = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ userId, role }: { userId: string | null; role?: string }) {
  // Route evaluators to their themed notifications page (/evaluator/notifications)
  // so the bell's "view all" stays inside the unified evaluator design.
  // Supervisors use the standard platform notifications page.
  const viewAllHref = role === 'evaluator' ? '/evaluator/notifications' : '/notifications';
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const { toasts, push, dismiss } = useToastStack();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setItems(data as unknown as Notif[]);
      });
  }, [userId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Live unread-count + dropdown updates: merge newly inserted rows into the
  // local list (deduping in case the initial fetch already raced it in) and
  // surface a toast with the bilingual title from notifications.types.*.
  useNotificationsStream(userId, {
    onInsert: (row: RealtimeNotification) => {
      setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row as unknown as Notif, ...prev]));
      const title = (locale === 'ar' ? row.title_ar : row.title_en) ?? t('title');
      const body = locale === 'ar' ? row.body_ar : row.body_en;
      push({ title, description: body, href: normalizeNotificationLink(row.link) });
    },
  });

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('title')}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-brand-teal-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-live="polite"
            className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-brand-teal">{t('title')}</span>
            <Link
              href={viewAllHref as any}
              onClick={() => setOpen(false)}
              className="text-xs text-brand-teal hover:underline"
            >
              {t('viewAll')}
            </Link>
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t('empty')}
              </li>
            )}
            {items.map((n) => {
              const title = locale === 'ar' ? n.title_ar : n.title_en;
              const body = locale === 'ar' ? n.body_ar : n.body_en;
              return (
                <li key={n.id} className={n.read_at ? '' : 'bg-brand-teal-light/30'}>
                  <Link
                    href={normalizeNotificationLink(n.link) as any}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    {body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {body}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} onNavigate={(href) => router.push(href as any)} />
    </div>
  );
}
