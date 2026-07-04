import type { MetadataRoute } from 'next';

// Public robots.txt policy. Marketing / content pages are indexable;
// authenticated app routes and the API are disallowed. Sitemap points
// to the locale-aware sitemap at /sitemap.xml.
//
// SITE_URL falls back to the production alias so `next build` in CI
// still emits an absolute Sitemap URL.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://innovation-to-impact.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/evaluation/',
          '/committee/',
          '/my-ideas/',
          '/dashboard/',
          '/settings/',
          '/en/admin/',
          '/ar/admin/',
          '/en/evaluation/',
          '/ar/evaluation/',
          '/en/committee/',
          '/ar/committee/',
          '/en/my-ideas/',
          '/ar/my-ideas/',
          '/en/dashboard/',
          '/ar/dashboard/',
          '/en/settings/',
          '/ar/settings/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
