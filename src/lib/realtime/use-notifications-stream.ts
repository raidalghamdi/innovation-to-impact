'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Shape mirrors the `notifications` table (innovation schema) as consumed by
// NotificationBell / NotificationsList — kept intentionally loose (string |
// null) so it lines up with the existing Notif types in those components.
export type RealtimeNotification = {
  id: string;
  user_id: string;
  type: string | null;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type UseNotificationsStreamOptions = {
  // Called with each newly inserted row for this user, in insertion order.
  onInsert: (row: RealtimeNotification) => void;
  // Optional: fired after the channel subscribes/unsubscribes/errors, useful
  // for surfacing a "live" indicator or falling back to polling.
  onStatusChange?: (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT') => void;
};

/**
 * Subscribes to INSERT events on innovation.notifications for the given user
 * and invokes `onInsert` for each new row. No-ops (and cleans up) when
 * Supabase isn't configured or `userId` is null — callers can safely render
 * unconditionally. Cleans up the channel subscription on unmount or when
 * `userId` changes.
 *
 * Requires the `notifications` table to be added to the `supabase_realtime`
 * publication (see supabase/migrations/00015_notifications_realtime.sql) —
 * if it isn't, the channel simply never fires and the UI keeps working off
 * its initial server-rendered/fetched list.
 */
export function useNotificationsStream(
  userId: string | null,
  { onInsert, onStatusChange }: UseNotificationsStreamOptions
): void {
  // Keep the latest callback in a ref so the effect doesn't need to
  // resubscribe every time the caller passes a fresh inline function.
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;

    let channel: RealtimeChannel | null = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'innovation',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsertRef.current(payload.new as RealtimeNotification);
        }
      )
      .subscribe((status) => {
        onStatusChangeRef.current?.(status as 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT');
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [userId]);
}
