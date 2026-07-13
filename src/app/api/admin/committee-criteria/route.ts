import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCommitteeCriteria } from '@/lib/committee-criteria';

export const dynamic = 'force-dynamic';

// Committee criteria = innovation.committee_criteria. Admin-managed (supervisor
// is promoted to admin by getCurrentUser). GET lists all; POST creates one.

function guard(role: string | undefined) {
  return role === 'admin';
}

// GET /api/admin/committee-criteria — list all criteria (active + inactive).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const criteria = await listCommitteeCriteria(false);
  return NextResponse.json({ criteria });
}

// POST /api/admin/committee-criteria — create a criterion.
// Body: { code, name_ar, name_en, description_ar?, description_en?, weight?, active? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? '').trim();
  const name_ar = String(body?.name_ar ?? '').trim();
  const name_en = String(body?.name_en ?? '').trim();
  if (!code || !name_ar || !name_en) {
    return NextResponse.json(
      { error: 'code, name_ar and name_en are required' },
      { status: 400 }
    );
  }
  const weightRaw = Number(body?.weight);
  const weight = Number.isFinite(weightRaw) ? weightRaw : 0;
  const active = body?.active === undefined ? true : Boolean(body.active);
  const description_ar = body?.description_ar != null ? String(body.description_ar).trim() : null;
  const description_en = body?.description_en != null ? String(body.description_en).trim() : null;

  const { data, error } = await admin
    .from('committee_criteria')
    .insert({ code, name_ar, name_en, description_ar, description_en, weight, active })
    .select('id, code, name_ar, name_en, description_ar, description_en, weight, active')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criterion: data });
}
