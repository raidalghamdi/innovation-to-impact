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
  '/evaluator',
  '/committee',
  '/pilots',
  '/analytics',
  '/admin',
  '/supervisor',
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
    // Sync (metadata + email) role — fast fallback when DB is unreachable.
    let role: Role = resolveRoleSync(user);

    // Canonical: fetch DB roles from innovation.v_user_roles. This is the ONLY
    // source of truth for multi-role users. `user_profiles.role` is legacy
    // and often stale ("member"), and `user_metadata.role` isn't populated
    // for users assigned via the /admin/users role editor. Without this,
    // e.g. AbdulazizO (evaluator in DB, "member" in profile) gets treated as
    // a submitter and blocked from /evaluation.
    const dbRoleCodes = new Set<string>();
    if (user.id) {
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
          .schema('innovation').from('v_user_roles')
          .select('role_code')
          .eq('user_id', user.id)
          .eq('role_active', true);
        for (const r of (roleRows as { role_code?: string }[] | null) ?? []) {
          if (r.role_code) dbRoleCodes.add(r.role_code.toLowerCase());
        }
      } catch {
        // ignore; fall back to sync role
      }
    }

    // Promote to the strongest DB role we found. Priority mirrors
    // getCurrentUser (see src/lib/user.ts).
    if (dbRoleCodes.has('admin') || dbRoleCodes.has('supervisor')) role = 'admin';
    else if (dbRoleCodes.has('judge') || dbRoleCodes.has('committee')) role = 'judge';
    else if (dbRoleCodes.has('evaluator')) role = 'evaluator';
    else if (dbRoleCodes.has('innovator') || dbRoleCodes.has('submitter')) role = 'submitter';

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
