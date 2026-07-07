import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';

// Canonical origin for absolute metadata URLs (OG image, canonical, hreflang).
// Override via NEXT_PUBLIC_SITE_URL in preview environments if needed.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://innovation-to-impact.vercel.app';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Frutiger LT Arabic — Competition Innovation Program brand Arabic typeface.
// Bound to --font-arabic (replaces IBM Plex Sans Arabic).
const frutigerArabic = localFont({
  src: [
    { path: '../../../public/fonts/FrutigerLTArabic45Light.ttf', weight: '300', style: 'normal' },
    { path: '../../../public/fonts/FrutigerLTArabic55Roman.ttf', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/FrutigerLTArabic65Bold.ttf', weight: '700', style: 'normal' },
    { path: '../../../public/fonts/frutigerltarabic75black.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
});

// Locale-aware metadata. Next 14 supports async generateMetadata on route
// segments; params.locale drives EN vs AR copy and hreflang alternates.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const isArabic = locale === 'ar';

  const titleDefault = isArabic
    ? 'من الفكرة إلى الأثر — الهيئة العامة للمنافسة'
    : 'Innovation to Impact — General Authority for Competition';

  const titleTemplate = isArabic
    ? '%s | من الفكرة إلى الأثر — الهيئة العامة للمنافسة'
    : '%s | Innovation to Impact — GAC';

  const description = isArabic
    ? 'المنصّة الموحّدة للابتكار في الهيئة العامة للمنافسة — نحوّل الأفكار والتحديات إلى أثر فعلي على المنافسة في المملكة العربية السعودية عبر تسع مراحل واضحة.'
    : 'The unified innovation platform of the General Authority for Competition (GAC), Saudi Arabia — turning ideas and challenges into measurable impact through a nine-stage journey.';

  const ogImage = {
    url: `${SITE_URL}/brand/og-image.png`,
    width: 1200,
    height: 630,
    alt: isArabic
      ? 'منصة من الفكرة إلى الأثر'
      : 'Innovation to Impact — GAC',
  };

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: titleDefault,
      template: titleTemplate,
    },
    description,
    // Canonical URL for this locale + hreflang alternates for the other locale.
    // x-default points to English per GAC preference for international referrers.
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        ar: `${SITE_URL}/ar`,
        'x-default': `${SITE_URL}/en`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: isArabic
        ? 'من الفكرة إلى الأثر'
        : 'Innovation to Impact',
      title: titleDefault,
      description,
      url: `${SITE_URL}/${locale}`,
      locale: isArabic ? 'ar_SA' : 'en_US',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleDefault,
      description,
      images: [ogImage.url],
    },
    robots: {
      // Public pages indexable. RBAC-gated pages are blocked in robots.txt +
      // middleware; noindex meta on those specific routes would be redundant.
      index: true,
      follow: true,
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  // Arabic-first: `--font-body` drives the Tailwind `sans` stack, so AR renders
  // in Frutiger LT Arabic and EN in Inter. Both font variables are still
  // present on <html> for explicit `font-arabic` usage and glyph fallback.
  const bodyFont = locale === 'ar' ? 'var(--font-arabic)' : 'var(--font-inter)';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${frutigerArabic.variable}`}
      style={{ '--font-body': bodyFont } as CSSProperties}
    >
      <body className="overflow-x-hidden font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
