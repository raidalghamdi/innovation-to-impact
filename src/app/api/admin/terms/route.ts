import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// PUT /api/admin/terms — src/app/api/admin/terms/route.ts:1
// Body: { locale: 'ar' | 'en', content: string }. Admin-only. Upserts the
// innovation.terms_content row for the locale and revalidates /terms.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { locale, content } = await req.json().catch(() => ({}));
  if (locale !== 'ar' && locale !== 'en') {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 });
  }
  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'empty_content' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const { error } = await admin.from('terms_content').upsert(
    { locale, content, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'locale' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/${locale}/terms`);
  return NextResponse.json({ ok: true });
}
