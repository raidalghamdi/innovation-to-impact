'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BackToTop({ label }: { label: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={label}
      title={label}
      className={cn(
        'fixed bottom-6 z-40 flex items-center gap-2 rounded-full bg-brand-teal px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-brand-teal-dark',
        // RTL-aware position
        'end-6',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      )}
    >
      <ArrowUp className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
