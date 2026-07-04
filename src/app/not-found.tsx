import Link from 'next/link';

/**
 * Root-level 404. Rendered by Next.js when no route matches at all —
 * e.g. `/en/this-url-does-not-exist`. The locale-aware not-found.tsx
 * inside `[locale]/` only fires when a matched route calls `notFound()`,
 * so we need this root fallback for arbitrary unknown URLs.
 *
 * We can't use `getTranslations` here because next-intl isn't mounted
 * outside the `[locale]` segment. Show bilingual copy inline so both
 * audiences get a useful page.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
          background: '#F7F5EF',
          color: '#232529',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '560px', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#C8A23A',
              margin: 0,
            }}
          >
            404
          </p>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#1C4854',
              margin: '0.5rem 0 0.25rem',
            }}
          >
            Page not found
          </h1>
          <p
            lang="ar"
            dir="rtl"
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1C4854',
              margin: '0 0 1rem',
            }}
          >
            الصفحة غير موجودة
          </p>
          <p style={{ color: '#5A5957', lineHeight: 1.6 }}>
            The page you are looking for does not exist on the Innovation to Impact platform.
          </p>
          <p lang="ar" dir="rtl" style={{ color: '#5A5957', lineHeight: 1.6 }}>
            الصفحة التي تبحث عنها غير موجودة على منصّة من الفكرة إلى الأثر.
          </p>
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/en"
              style={{
                background: '#1C4854',
                color: '#fff',
                padding: '0.65rem 1.25rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              English homepage
            </Link>
            <Link
              href="/ar"
              style={{
                background: 'transparent',
                color: '#1C4854',
                border: '1px solid #1C4854',
                padding: '0.65rem 1.25rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              الصفحة الرئيسيّة
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
