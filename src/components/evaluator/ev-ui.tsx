'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Inbox, type LucideProps } from 'lucide-react';

/**
 * B9 — shared evaluator primitives: empty state, progress ring, success
 * overlay, and toast. All scoped visually by the `.ev-root` wrapper tokens.
 */

export function EvEmptyState({
  icon: Icon = Inbox,
  title,
  hint,
}: {
  icon?: ComponentType<LucideProps>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-16 text-center">
      <Icon className="h-12 w-12 text-[var(--ink-faint)]" strokeWidth={1.5} />
      <p className="mt-4 font-display text-lg font-bold text-[var(--ink)]">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-[var(--ink-soft)]">{hint}</p>}
    </div>
  );
}

// SVG progress ring used by dashboard stat cards + evaluation overall score.
export function EvRing({
  value,
  max,
  color,
  label,
  size = 72,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="ev-num absolute inset-0 flex items-center justify-center text-sm font-semibold text-[var(--ink)]">
        {label}
      </span>
    </div>
  );
}

// Fullscreen success overlay (~1.5s) then onDone(). Used after evaluation submit.
export function EvSuccessOverlay({
  title,
  subtitle,
  onDone,
}: {
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ev-overlay">
      <div className="w-[min(90vw,360px)] rounded-[var(--radius-lg)] bg-white p-8 text-center shadow-[var(--shadow-pop)]">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'var(--sage-soft)', border: '3px solid var(--sage)' }}
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="var(--sage)" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 font-display text-lg font-bold text-[var(--ink)]">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-[var(--ink-soft)]">{subtitle}</p>}
      </div>
    </div>
  );
}

export function EvToast({ message, show }: { message: string; show: boolean }) {
  const [visible, setVisible] = useState(show);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2600);
      return () => clearTimeout(t);
    }
  }, [show]);
  if (!visible) return null;
  return <div className="ev-toast">{message}</div>;
}
