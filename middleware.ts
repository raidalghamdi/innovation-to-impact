import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './src/i18n/routing';
import { canAccess, roleFromEmail, ROLE_HOME, isRole, type Role } from './src/lib/roles';

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (locale prefix stripped before matching)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/strategy',
  '/ideas',
  '/my-ideas',
  '/activities',
  '/evaluation',
  '/committee',
  '/pilots',
  '/implementation',
  '/benefits',
  '/ip',
  '/knowledge',
  '/compliance',
  '/analytics',
  '/admin',
  '/settings',
  '/notifications',
];

export async function middleware(request: NextRequest) {
  // First run the intl middleware so cookies / locale are set
  const response = intlMiddleware(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // [DIAG] TEMP: log env-var presence to diagnose auth-bypass P0.
  console.log('[mw] env ok:', !!supabaseUrl, !!supabaseKey, 'path:', request.nextUrl.pathname);

  // If Supabase is not configured (e.g. during build / preview), skip auth.
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[mw] SKIPPING AUTH — env vars missing');
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

  // Wrap getUser in try/catch so a thrown error is treated as unauthenticated,
  // not silently allowed.
  let user: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[mw] getUser error:', error.message);
    }
    user = data?.user ?? null;
  } catch (err) {
    console.error('[mw] getUser threw:', err instanceof Error ? err.message : String(err));
    user = null;
  }

  const { pathname } = request.nextUrl;
  // strip locale prefix (/ar or /en)
  const pathnameWithoutLocale = pathname.replace(/^\/(ar|en)/, '') || '/';
  const locale = pathname.split('/')[1] || routing.defaultLocale;

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(`${p}/`)
  );

  // [DIAG] TEMP: log the exact decision inputs.
  console.log('[mw] decision — path:', pathnameWithoutLocale, 'protected:', isProtected, 'user:', user?.id ?? 'null');

  if (isProtected && !user?.id) {
    console.log('[mw] REDIRECTING to /' + locale + '/login');
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // RBAC — enforce role-based access on protected routes.
  if (isProtected && user) {
    const role: Role = isRole(user.user_metadata?.role)
      ? (user.user_metadata!.role as Role)
      : roleFromEmail(user.email);
    // Exception: /admin/analytics is allowed for judges (not the rest of /admin).
    const isAnalyticsRoute =
      pathnameWithoutLocale === '/admin/analytics' ||
      pathnameWithoutLocale.startsWith('/admin/analytics/');
    const analyticsAllowed = isAnalyticsRoute && (role === 'admin' || role === 'judge');
    if (!analyticsAllowed && !canAccess(role, pathnameWithoutLocale)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${ROLE_HOME[role]}`;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
