import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (locale prefix stripped before matching)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/strategy',
  '/ideas',
  '/activities',
  '/evaluation',
  '/committee',
  '/pilots',
  '/implementation',
  '/benefits',
  '/funding',
  '/ip',
  '/knowledge',
  '/compliance',
  '/analytics',
  '/admin',
  '/settings',
];

export async function middleware(request: NextRequest) {
  // First run the intl middleware so cookies / locale are set
  const response = intlMiddleware(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured (e.g. during build / preview), skip auth.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // strip locale prefix (/ar or /en)
  const pathnameWithoutLocale = pathname.replace(/^\/(ar|en)/, '') || '/';
  const locale = pathname.split('/')[1] || routing.defaultLocale;

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(`${p}/`)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
