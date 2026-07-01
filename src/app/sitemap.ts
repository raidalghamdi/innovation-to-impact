import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://innovation-to-impact.vercel.app';

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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of PUBLIC_PATHS) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : 0.6,
      });
    }
  }

  return entries;
}
