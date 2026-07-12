import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { serializeJsonLd } from '@/lib/json-ld';

export type Crumb = { href?: string; label: string };

// Breadcrumbs with locale-aware chevron and JSON-LD (Phase C).
export async function Breadcrumbs({
  items,
  locale,
}: {
  items: Crumb[];
  locale: string;
}) {
  const t = await getTranslations('nav');
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: t('home') }, ...items].map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: (it as any).label ?? (it as any).name,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link href="/" className="flex items-center gap-1 hover:text-brand-teal">
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">{t('home')}</span>
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <Chevron className="h-3.5 w-3.5 shrink-0" />
            {c.href && i < items.length - 1 ? (
              <Link href={c.href as any} className="hover:text-brand-teal">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </nav>
  );
}
