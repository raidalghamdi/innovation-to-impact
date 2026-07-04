'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// Counts down to an ISO target date. Rendered inside a dark hero band.
//
// If `target` prop is omitted, falls back to NEXT_PUBLIC_SUBMISSION_DEADLINE.
// If neither is present or the value cannot be parsed as a valid date,
// the component renders nothing.
//
// Both server and client render the SAME initial computed values (based on
// wall-clock at render time). suppressHydrationWarning is used on the digit
// spans because there is a tiny (sub-second) drift between the SSR wall-clock
// and the client hydration wall-clock — the client tick fixes it within 1s.
// This eliminates the em-dash flash and the JS-disabled-forever dashes that
// existed in the previous version.
export function Countdown({ target }: { target?: string }) {
  const t = useTranslations('landing');

  const raw = target ?? process.env.NEXT_PUBLIC_SUBMISSION_DEADLINE;
  const end = raw ? new Date(raw).getTime() : NaN;
  const valid = Number.isFinite(end);

  // Initial value is computed synchronously on BOTH server and client so the
  // rendered HTML always shows real digits, not em-dashes.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!valid) return;
    // Refresh immediately in case SSR wall-clock differs from client wall-clock,
    // then tick every second.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [valid]);

  if (!valid) return null;

  const diff = Math.max(0, end - now);
  const ended = diff <= 0;

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
              <span
                className="text-2xl font-bold tabular-nums text-white"
                suppressHydrationWarning
              >
                {String(u.v).padStart(2, '0')}
              </span>
              <span className="text-[11px] text-white/80">{u.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
