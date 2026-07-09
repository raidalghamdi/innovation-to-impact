'use client';

// Landing-page preview of the evaluator's latest notifications. Self-fetches the
// 5 most recent rows via the browser Supabase client (mirrors the pattern in
// evaluator-notifications.tsx) but does NOT mark them as read — that only
// happens on the dedicated notifications page.

import { useEffect, useState } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

type Notif = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  read_at: string | null;
  created_at: string;
};

type Props = {
  locale: string;
  heading: string;
  viewAllLabel: string;
  emptyLabel: string;
};

export function EvaluatorNotificationsPreview({ locale, heading, viewAllLabel, emptyLabel }: Props) {
  const isAr = locale === 'ar';
  const [items, setItems] = useState<Notif[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          setLoaded(true);
          return;
        }
        const { data: rows } = await supabase
          .from('notifications')
          .select('id, title_ar, title_en, read_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (rows) setItems(rows as unknown as Notif[]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[evaluator-notifications-preview] load failed:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">{heading}</h2>
        <Link
          href="/evaluator/notifications"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--gold-deep)]"
        >
          {viewAllLabel}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      {loaded && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
          <Bell className="h-10 w-10 text-[var(--ink-faint)]" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-[var(--ink-soft)]">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="ev-card divide-y divide-[var(--line)]">
          {items.map((n) => {
            const title = (isAr ? n.title_ar : n.title_en) || (isAr ? n.title_en : n.title_ar) || '—';
            const unread = !n.read_at;
            return (
              <li key={n.id} className="flex items-center gap-3 p-4">
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--rust)]" />}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
                    unread ? '' : 'ms-5'
                  }`}
                  style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">{title}</p>
                <span className="ev-num shrink-0 text-xs text-[var(--ink-faint)]">
                  {formatDate(n.created_at, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
