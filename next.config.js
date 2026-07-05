const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Content-Security-Policy tuned for:
//   - Next.js 14 App Router (needs 'unsafe-inline' + 'unsafe-eval' on script-src
//     until we wire nonce-based CSP through middleware — tracked separately)
//   - Supabase REST/Auth/Realtime (HTTPS + WebSocket)
//   - Google Fonts (Cairo, used by the Arabic UI)
//   - Next/Image data: URIs and blob: URIs for blur placeholders
//   - frame-ancestors 'none' → equivalent to X-Frame-Options: DENY at CSP level
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

// NCA ECC + OWASP-aligned security headers.
// See docs/SECURITY.md for rationale on each header value (esp. X-XSS-Protection: 0
// and the intentional omission of CSRF-token middleware).
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Modern OWASP guidance: 0 disables the legacy XSS auditor that itself
  // introduced XSS in some browsers. CSP + frame-ancestors is the real defence.
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Report-Only on first deploy so we can observe violations for ~24h before
  // switching to enforcing mode. To enforce: rename this key to
  // 'Content-Security-Policy'.
  { key: 'Content-Security-Policy-Report-Only', value: CSP_DIRECTIVES },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure the embedded Arabic TTFs used by the PDF export are traced into the
  // serverless bundle for the /api/exports/* route handlers.
  outputFileTracingIncludes: {
    '/api/exports/**': ['./src/lib/exports/fonts/**'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        // Apply to every route.
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/:locale(ar|en)/challenges/:path*',
        destination: '/:locale/ideas',
        permanent: true,
      },
      {
        source: '/challenges/:path*',
        destination: '/ideas',
        permanent: true,
      },

      // ── Landing subpages folded into one-page landing anchors ──────────
      { source: '/:locale(ar|en)/about', destination: '/:locale/#about', permanent: true },
      { source: '/about', destination: '/#about', permanent: true },

      { source: '/:locale(ar|en)/roadmap', destination: '/:locale/#timeline', permanent: true },
      { source: '/roadmap', destination: '/#timeline', permanent: true },

      // NOTE: only the exact /tracks route redirects — /tracks/[id] subroutes
      // are a real, separate page and must NOT be caught by this rule.
      { source: '/:locale(ar|en)/tracks', destination: '/:locale/#tracks', permanent: true },
      { source: '/tracks', destination: '/#tracks', permanent: true },

      { source: '/:locale(ar|en)/timeline', destination: '/:locale/#timeline', permanent: true },
      { source: '/timeline', destination: '/#timeline', permanent: true },

      { source: '/:locale(ar|en)/criteria', destination: '/:locale/#criteria', permanent: true },
      { source: '/criteria', destination: '/#criteria', permanent: true },

      { source: '/:locale(ar|en)/prizes', destination: '/:locale/#prizes', permanent: true },
      { source: '/prizes', destination: '/#prizes', permanent: true },

      { source: '/:locale(ar|en)/faq', destination: '/:locale/#faq', permanent: true },
      { source: '/faq', destination: '/#faq', permanent: true },

      { source: '/:locale(ar|en)/partners', destination: '/:locale/#partners', permanent: true },
      { source: '/partners', destination: '/#partners', permanent: true },

      { source: '/:locale(ar|en)/stages', destination: '/:locale/#timeline', permanent: true },
      { source: '/stages', destination: '/#timeline', permanent: true },

      { source: '/:locale(ar|en)/expected-solutions', destination: '/:locale/#tracks', permanent: true },
      { source: '/expected-solutions', destination: '/#tracks', permanent: true },

      { source: '/:locale(ar|en)/target-audience', destination: '/:locale/#about', permanent: true },
      { source: '/target-audience', destination: '/#about', permanent: true },

      { source: '/:locale(ar|en)/evaluation-criteria', destination: '/:locale/#criteria', permanent: true },
      { source: '/evaluation-criteria', destination: '/#criteria', permanent: true },

      // ── Deleted pages merged into other routes ──────────────────────────
      { source: '/:locale(ar|en)/ip', destination: '/:locale/ip-terms', permanent: true },
      { source: '/ip', destination: '/ip-terms', permanent: true },

      { source: '/:locale(ar|en)/implementation', destination: '/:locale/pilots', permanent: true },
      { source: '/implementation', destination: '/pilots', permanent: true },

      // strategy/benefits/compliance/knowledge content moved into track detail
      // pages and the one-page landing. Redirect old URLs to the closest
      // relevant landing anchor so external links / bookmarks still resolve.
      { source: '/:locale(ar|en)/strategy', destination: '/:locale/#about', permanent: true },
      { source: '/strategy', destination: '/#about', permanent: true },

      { source: '/:locale(ar|en)/benefits', destination: '/:locale/#numbers', permanent: true },
      { source: '/benefits', destination: '/#numbers', permanent: true },

      { source: '/:locale(ar|en)/compliance', destination: '/:locale/#details', permanent: true },
      { source: '/compliance', destination: '/#details', permanent: true },

      { source: '/:locale(ar|en)/knowledge', destination: '/:locale/#previous', permanent: true },
      { source: '/knowledge', destination: '/#previous', permanent: true },

      { source: '/:locale(ar|en)/leaderboard', destination: '/:locale/profile/level', permanent: true },
      { source: '/leaderboard', destination: '/profile/level', permanent: true },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
