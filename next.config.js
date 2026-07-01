const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
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
