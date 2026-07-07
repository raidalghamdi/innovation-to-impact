'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

// Appears fixed at the bottom once the user scrolls past the hero.
// Hidden for admins — admins manage the pipeline, they don't submit ideas.
export function StickyCta({ role }: { role?: string | null } = {}) {
  const t = useTranslations('landing');
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 600);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Admins never see the "Submit Idea" sticky bar on the landing page.
  if (role === 'admin') return null;
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:hidden">
      <Link
        href="/ideas/new"
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-teal"
      >
        <Lightbulb className="h-4 w-4" />
        {t('stickyCta')}
      </Link>
    </div>
  );
}
