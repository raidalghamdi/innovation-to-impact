'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { EvEmptyState } from '@/components/evaluator/ev-ui';

type Notif = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  read_at: string | null;
  created_at: string;
};

export function EvaluatorNotifications({ locale }: { locale: string }) {
  const t = useTranslations('evaluator');
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
          .select('id, title_ar, title_en, body_ar, body_en, read_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (rows) setItems(rows as unknown as Notif[]);
        // B7 — mark all as read on page enter.
        const now = new Date().toISOString();
        await supabase
          .from('notifications')
          .update({ read_at: now })
          .eq('user_id', user.id)
          .is('read_at', null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[evaluator-notifications] load failed:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (loaded && items.length === 0) {
    return <EvEmptyState icon={Bell} title={t('emptyNotificationsTitle')} hint={t('emptyNotificationsHint')} />;
  }

  return (
    <ul className="ev-card divide-y divide-[var(--line)]">
      {items.map((n) => {
        const title = isAr ? n.title_ar : n.title_en;
        const body = isAr ? n.body_ar : n.body_en;
        const unread = !n.read_at;
        return (
          <li key={n.id} className="flex items-start gap-3 p-4">
            {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--rust)]" />}
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
                unread ? '' : 'ms-5'
              }`}
              style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}
            >
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
              {body && <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{body}</p>}
            </div>
            <span className="ev-num shrink-0 text-xs text-[var(--ink-faint)]">
              {formatDate(n.created_at, locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
