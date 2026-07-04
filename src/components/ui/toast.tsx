'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Minimal, dependency-free toast stack used by realtime notification surfaces
// (see use-notifications-stream.ts consumers). Deliberately small — a full
// Radix toast provider is unnecessary for a single fire-and-forget use case.

export type ToastItem = {
  id: string;
  title: string;
  description?: string | null;
  href?: string | null;
};

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `toast-${Date.now()}-${idSeq}`;
}

export function useToastStack(autoDismissMs = 6000) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = nextId();
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (autoDismissMs > 0) {
        setTimeout(() => dismiss(id), autoDismissMs);
      }
      return id;
    },
    [autoDismissMs, dismiss]
  );

  return { toasts, push, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
  onNavigate,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onNavigate?: (href: string) => void;
}) {
  useEffect(() => {}, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg',
            toast.href && 'cursor-pointer hover:bg-muted/50'
          )}
          onClick={() => {
            if (toast.href && onNavigate) onNavigate(toast.href);
          }}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{toast.title}</p>
            {toast.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
