import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://innovation-to-impact.vercel.app';

// Public, indexable routes (no auth-gated dashboards).
const PUBLIC_PATHS = [
  '',
  '/about',
  '/target-audience',
  '/evaluation-criteria',
  '/expected-solutions',
  '/partners',
  '/faq',
  '/support',
  '/roadmap',
  '/stages',
  '/events',
  '/events/main',
  '/events/hackathon',
  '/events/workshops',
  '/privacy',
  '/terms',
  '/ideas/new',
];

// Emits one entry per (locale, path) with the required covered paths, plus
// alternates.languages so Google can pair EN <-> AR versions of each page
// (hreflang). Homepages get priority 1 and daily change frequency; interior
// pages get 0.6 and weekly.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of PUBLIC_PATHS) {
      const otherLocales = routing.locales.filter((l) => l !== locale);
      const languages: Record<string, string> = {
        [locale]: `${BASE_URL}/${locale}${path}`,
      };
      for (const other of otherLocales) {
        languages[other] = `${BASE_URL}/${other}${path}`;
      }
      // x-default: point to English so international referrers land on EN by default.
      languages['x-default'] = `${BASE_URL}/en${path}`;

      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : 0.6,
        alternates: { languages },
      });
    }
  }

  return entries;
}
