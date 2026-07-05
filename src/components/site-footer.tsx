'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Linkedin, Twitter, Youtube } from 'lucide-react';
import { SOCIAL_LINKS } from '@/lib/social-links';
import type { LucideIcon } from 'lucide-react';

const SOCIAL_ICONS: Record<(typeof SOCIAL_LINKS)[number]['id'], LucideIcon> = {
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
};

const QUICK_LINKS = [
  { href: '/#about', key: 'about' },
  { href: '/#about', key: 'targetAudience' },
  { href: '/#criteria', key: 'evaluationCriteria' },
  { href: '/#tracks', key: 'expectedSolutions' },
  { href: '/#timeline', key: 'roadmap' },
  { href: '/events', key: 'events' },
] as const;

const SUPPORT_LINKS = [
  { href: '/#faq', key: 'faq' },
  { href: '/support', key: 'support' },
  { href: '/#partners', key: 'partners' },
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
] as const;

export function SiteFooter({ locale: _locale }: { locale: string }) {
  const t = useTranslations('footer');
  const tapp = useTranslations('app');

  return (
    <footer className="border-t border-border bg-brand-teal text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-1">
          <h3 className="text-sm font-semibold">{tapp('name')}</h3>
          <p className="mt-3 text-sm text-white/80">{t('tagline')}</p>
          <div className="mt-4 flex gap-3">
            {SOCIAL_LINKS.map((s) => {
              const Icon = SOCIAL_ICONS[s.id];
              return (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-white/80 hover:text-white"
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{t('quickLinks')}</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{t('support')}</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {SUPPORT_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{tapp('owner')}</h3>
          <p className="mt-3 text-sm text-white/80">{t('address')}</p>
          <p className="mt-2 text-sm text-white/80" dir="ltr">
            {t('contactEmail')}
          </p>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-white/70 sm:px-8">
          © {new Date().getFullYear()} {tapp('owner')} · {tapp('name')} — {t('rights')}
        </div>
      </div>
    </footer>
  );
}
