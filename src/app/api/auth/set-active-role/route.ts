import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { getMyUserRoles } from '@/lib/db-roles';

export const dynamic = 'force-dynamic';

// POST /api/auth/set-active-role — src/app/api/auth/set-active-role/route.ts:1
// Sets the i2i_active_role cookie after validating the requested role is one
// the current user actually holds (role-selection screen + header switcher).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { role } = await req.json().catch(() => ({ role: null }));
  if (!role || typeof role !== 'string') {
    return NextResponse.json({ error: 'missing_role' }, { status: 400 });
  }

  const myRoles = await getMyUserRoles();
  const allowed = myRoles.length > 0 ? myRoles.map((r) => r.role_code) : ['innovator'];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'role_not_assigned' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set('i2i_active_role', role, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
