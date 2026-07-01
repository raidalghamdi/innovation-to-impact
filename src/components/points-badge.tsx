'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Star } from 'lucide-react';

// Compact points/level pill shown in the app header. Fetches the current user's
// points client-side; renders nothing until data is available.
export function PointsBadge({ userId }: { userId: string | null }) {
  const t = useTranslations('leaderboard');
  const [data, setData] = useState<{ points: number; level: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from('user_profiles')
      .select('points, level')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setData({ points: (data.points as number) ?? 0, level: (data.level as number) ?? 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;

  return (
    <Link
      href="/leaderboard"
      className="hidden items-center gap-1.5 rounded-full border border-border bg-brand-teal-light/40 px-2.5 py-1 text-xs font-medium text-brand-teal transition hover:bg-brand-teal-light sm:inline-flex"
      title={`${t('levelShort')} ${data.level} · ${data.points} ${t('pointsUnit')}`}
    >
      <Star className="h-3.5 w-3.5 text-brand-gold" />
      <span>
        {t('levelShort')} {data.level}
      </span>
      <span className="text-brand-teal/60">·</span>
      <span>
        {data.points} {t('pointsUnit')}
      </span>
    </Link>
  );
}
