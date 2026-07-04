'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useNotificationsStream, type RealtimeNotification } from '@/lib/realtime/use-notifications-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Bell, Check } from 'lucide-react';

type Notif = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsList() {
  const t = useTranslations('notifications');
  const te = useTranslations('emptyStates');
  const locale = useLocale();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    // Guard the whole flow — auth.getUser() and the notifications fetch have
    // both been observed to reject (network hiccup, RLS misconfiguration,
    // realtime channel handshake) which would otherwise bubble as an
    // unhandled promise rejection and trip the [locale]/error.tsx boundary
    // with a generic "An unexpected error occurred" screen. On failure we
    // simply render the empty state instead of taking down the page.
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) {
          setLoaded(true);
          return;
        }
        setUserId(user.id);
        const { data: rows, error: fetchErr } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (fetchErr) {
          // eslint-disable-next-line no-console
          console.error('[notifications-list] fetch failed:', fetchErr);
        } else if (rows) {
          setItems(rows as unknown as Notif[]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifications-list] initial load threw:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Take over from the initial fetch: merge newly inserted rows live so the
  // full notifications page stays current without a refresh.
  useNotificationsStream(userId, {
    onInsert: (row: RealtimeNotification) => {
      setItems((prev) =>
        prev.some((i) => i.id === row.id) ? prev : [row as unknown as Notif, ...prev]
      );
    },
  });

  async function markAll() {
    const supabase = createClient();
    if (!supabase) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? now })));
    const { data } = await supabase.auth.getUser();
    if (data.user)
      await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', data.user.id)
        .is('read_at', null);
  }

  const shown = filter === 'unread' ? items.filter((i) => !i.read_at) : items;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2" role="tablist">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? 'rounded-md bg-brand-teal px-3 py-1.5 text-sm text-white'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
              }
            >
              {t(f)}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={markAll}>
          <Check className="h-4 w-4" /> {t('markAllRead')}
        </Button>
      </div>

      {loaded && shown.length === 0 && (
        <EmptyState
          icon={Bell}
          title={te('notificationsTitle')}
          description={te('notificationsBody')}
        />
      )}

      <ul className="space-y-2">
        {shown.map((n) => {
          const title = locale === 'ar' ? n.title_ar : n.title_en;
          const body = locale === 'ar' ? n.body_ar : n.body_en;
          return (
            <li key={n.id}>
              <Card className={n.read_at ? '' : 'border-brand-teal/40 bg-brand-teal-light/20'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {n.created_at?.slice(0, 10)}
                    </span>
                  </div>
                  {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
