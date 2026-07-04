'use client';

import { useEffect, useState } from 'react';

type Initial = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type Labels = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  title: string;
  ended: string;
};

// Client-side ticker. Receives the pre-computed initial values from the SERVER
// Countdown component. Renders those exact values first (so hydration matches
// SSR byte-for-byte) then swaps to client wall-clock on mount and ticks every
// second.
export function CountdownTicker({
  endMs,
  initial,
  labels,
}: {
  endMs: number;
  initial: Initial;
  labels: Labels;
}) {
  const [state, setState] = useState<Initial>(initial);
  const [ended, setEnded] = useState<boolean>(
    initial.days === 0 &&
      initial.hours === 0 &&
      initial.minutes === 0 &&
      initial.seconds === 0
  );

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, endMs - Date.now());
      if (diff <= 0) {
        setState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setEnded(true);
        return;
      }
      setState({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
      setEnded(false);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  const units = [
    { v: state.days, label: labels.days },
    { v: state.hours, label: labels.hours },
    { v: state.minutes, label: labels.minutes },
    { v: state.seconds, label: labels.seconds },
  ];

  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
      <p className="text-center text-sm font-medium text-white/90">
        {ended ? labels.ended : labels.title}
      </p>
      {!ended && (
        <div className="mt-3 flex justify-center gap-3" aria-live="off">
          {units.map((u) => (
            <div
              key={u.label}
              className="flex min-w-16 flex-col items-center rounded-xl bg-white/15 px-3 py-2"
            >
              <span className="text-2xl font-bold tabular-nums text-white">
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
