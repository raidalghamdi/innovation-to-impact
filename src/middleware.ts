import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { canAccess, resolveRoleSync, ROLE_HOME, type Role } from './lib/roles';

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (locale prefix stripped before matching)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/ideas',
  '/my-ideas',
  '/activities',
  '/evaluation',
  '/committee',
  '/pilots',
  '/analytics',
  '/admin',
  '/settings',
  '/notifications',
  '/team',
  '/profile',
  '/select-role',
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

  // Wrap getUser in try/catch so a thrown error is treated as unauthenticated,
  // not silently allowed.
  let user: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  // strip locale prefix (/ar or /en)
  const pathnameWithoutLocale = pathname.replace(/^\/(ar|en)/, '') || '/';
  const locale = pathname.split('/')[1] || routing.defaultLocale;

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(`${p}/`)
  );

  if (isProtected && !user?.id) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // RBAC — enforce role-based access on protected routes.
  if (isProtected && user) {
    // Edge runtime: no DB queries per request, so use the sync resolver
    // (metadata → email). See resolveRoleSync in src/lib/roles.ts.
    const role: Role = resolveRoleSync(user);
    // Exception: /admin/analytics is allowed for judges (not the rest of /admin).
    const isAnalyticsRoute =
      pathnameWithoutLocale === '/admin/analytics' ||
      pathnameWithoutLocale.startsWith('/admin/analytics/');
    const analyticsAllowed = isAnalyticsRoute && (role === 'admin' || role === 'judge');
    const isAdminRoute =
      pathnameWithoutLocale === '/admin' || pathnameWithoutLocale.startsWith('/admin/');
    let hasDbAdminRole = false;
    // src/middleware.ts — Batch B multi-role fix: legacy `resolveRoleSync`
    // only reads user_profiles.role via JWT metadata/email, so DB-only
    // admins (assigned solely through innovation.user_roles, e.g. via the
    // new /admin/users role editor) were being redirected away from /admin/*
    // before the page component's isCurrentUserAdmin() check could even run.
    // This does ONE extra query, scoped to /admin/* only, against the
    // `innovation` schema (schema config untouched elsewhere), to check for
    // a DB-driven `admin` role. Additive only — legacy admins still pass via
    // resolveRoleSync above with zero extra queries on non-admin routes.
    if (isAdminRoute && role !== 'admin' && user.id) {
      try {
        const innovationClient = createServerClient(supabaseUrl, supabaseKey, {
          db: { schema: 'innovation' },
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // no-op: this client is read-only for a role check
            },
          },
        });
        const { data: roleRows } = await innovationClient
          .from('v_user_roles')
          .select('role_code')
          .eq('user_id', user.id)
          .eq('role_active', true)
          .eq('role_code', 'admin')
          .limit(1);
        hasDbAdminRole = !!roleRows && roleRows.length > 0;
      } catch {
        hasDbAdminRole = false;
      }
    }
    if (!analyticsAllowed && !hasDbAdminRole && !canAccess(role, pathnameWithoutLocale)) {
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
