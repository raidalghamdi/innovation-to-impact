import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ArrowRight, LayoutDashboard } from 'lucide-react';

/**
 * /admin/* wrapper layout — adds:
 *   - A locale-aware "Back to Admin Hub" link on every admin sub-page.
 *   - A dynamic Breadcrumbs trail derived from the pathname.
 *   - JSON-LD BreadcrumbList (SEO + a11y).
 *
 * The layout is intentionally lightweight (server component only, no client
 * JS) so it doesn't interfere with the sub-pages that already ship their own
 * headers, filters, and toolbars. It renders ABOVE the sub-page content.
 *
 * The bare /admin index page also passes through this layout; its `page.tsx`
 * already renders its own title, so we skip breadcrumbs on the hub itself.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const tn = await getTranslations('nav');

  const hdr = await headers();
  // next/headers exposes the request path via x-invoke-path or x-pathname
  // (both are set by next.js/vercel edge on different runtimes). Fall back
  // to the referer if neither is present.
  const rawPath =
    hdr.get('x-invoke-path') ||
    hdr.get('x-pathname') ||
    hdr.get('next-url') ||
    '';
  const pathname = rawPath.replace(/^\/(ar|en)/, '') || '/admin';

  // Only render breadcrumbs on /admin/* SUB-pages, not on the /admin hub.
  const isHubIndex = pathname === '/admin' || pathname === '/admin/';

  // Section → localized label. Keeps the admin sidebar labels in sync with the
  // breadcrumb labels: single source of truth for the top of the trail.
  const SECTION_LABEL_KEYS: Record<string, string> = {
    users: 'usersTitle',
    roles: 'rolesTitle',
    employees: 'employeesImportTitle',
    settings: 'settingsTitle',
    audit: 'auditTitle',
    analytics: 'analyticsTitle',
    backup: 'backupTitle',
    escalations: 'escalationsTitle',
    'change-requests': 'changeRequestsTitle',
    assignments: 'assignmentsTitle',
    cms: 'cmsTitle',
  };
  const FALLBACK_LABELS_AR: Record<string, string> = {
    users: 'المستخدمون',
    roles: 'كتالوج الأدوار',
    employees: 'استيراد الموظفين',
    import: 'استيراد',
    settings: 'إعدادات المنصة',
    audit: 'سجلات التدقيق',
    analytics: 'التحليلات',
    backup: 'النسخ الاحتياطي',
    escalations: 'التصعيدات',
    'change-requests': 'طلبات التعديل',
    assignments: 'التعيينات',
    cms: 'محرر المحتوى',
  };
  const FALLBACK_LABELS_EN: Record<string, string> = {
    users: 'Users',
    roles: 'Roles Catalog',
    employees: 'Employees Import',
    import: 'Import',
    settings: 'Platform Settings',
    audit: 'Audit Logs',
    analytics: 'Analytics',
    backup: 'Backup',
    escalations: 'Escalations',
    'change-requests': 'Change Requests',
    assignments: 'Assignments',
    cms: 'Content Editor',
  };

  const parts = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean); // e.g. ['admin', 'settings'] or ['admin','employees','import']

  const isAr = locale === 'ar';
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  // Build breadcrumb items after "Admin Hub". Each intermediate segment gets
  // a link, the final segment is the current page (aria-current).
  const trail: { href: string | null; label: string }[] = [];
  let href = '/admin';
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    href = `${href}/${seg}`;
    const key = SECTION_LABEL_KEYS[seg];
    let label: string;
    try {
      label = key ? t(key) : '';
    } catch {
      label = '';
    }
    if (!label) {
      label = isAr
        ? FALLBACK_LABELS_AR[seg] ?? seg.replace(/-/g, ' ')
        : FALLBACK_LABELS_EN[seg] ?? seg.replace(/-/g, ' ');
    }
    trail.push({ href: i === parts.length - 1 ? null : href, label });
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tn('home') },
      { '@type': 'ListItem', position: 2, name: isAr ? 'لوحة الإدارة' : 'Admin Hub' },
      ...trail.map((c, i) => ({ '@type': 'ListItem', position: i + 3, name: c.label })),
    ],
  };

  return (
    <>
      {!isHubIndex && (
        <nav
          aria-label={isAr ? 'مسار التنقّل' : 'Breadcrumb'}
          className="mb-4 flex flex-wrap items-center justify-between gap-3"
        >
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link
                href={'/admin' as any}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-brand-teal transition hover:bg-brand-teal-light/40"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>{isAr ? 'لوحة الإدارة' : 'Admin Hub'}</span>
              </Link>
            </li>
            {trail.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span aria-hidden="true">/</span>
                {c.href ? (
                  <Link href={c.href as any} className="hover:text-brand-teal">
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                  >
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <Link
            href={'/admin' as any}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-brand-teal transition hover:bg-brand-teal-light/40"
          >
            <BackArrow className="h-4 w-4" aria-hidden="true" />
            <span>{isAr ? 'العودة للوحة الإدارة' : 'Back to Admin Hub'}</span>
          </Link>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </nav>
      )}
      {children}
    </>
  );
}
