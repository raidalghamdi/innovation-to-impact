'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Counts down to an ISO target date. Rendered inside a dark hero band.
export function Countdown({ target }: { target: string }) {
  const t = useTranslations('landing');
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(target).getTime();
  const diff = now === null ? 0 : Math.max(0, end - now);
  const ended = now !== null && diff <= 0;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const units = [
    { v: days, label: t('days') },
    { v: hours, label: t('hours') },
    { v: minutes, label: t('minutes') },
    { v: seconds, label: t('seconds') },
  ];

  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
      <p className="text-center text-sm font-medium text-white/90">
        {ended ? t('countdownEnded') : t('countdownTitle')}
      </p>
      {!ended && (
        <div className="mt-3 flex justify-center gap-3" aria-live="off">
          {units.map((u) => (
            <div
              key={u.label}
              className="flex min-w-16 flex-col items-center rounded-xl bg-white/15 px-3 py-2"
            >
              <span className="text-2xl font-bold tabular-nums text-white">
                {now === null ? '—' : String(u.v).padStart(2, '0')}
              </span>
              <span className="text-[11px] text-white/80">{u.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
