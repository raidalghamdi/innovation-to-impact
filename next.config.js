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
    ];
  },
};

module.exports = withNextIntl(nextConfig);
