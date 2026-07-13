import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Evaluator <-> track (strategic theme) assignment toggle. Writes
// innovation.evaluator_track_assignments (00033): columns evaluator_id,
// track_id, assigned_by, assigned_at. Admin OR supervisor may manage (both are
// allowed explicitly; getCurrentUser may already have promoted supervisor to
// 'admin').

function guard(role: string | undefined) {
  return role === 'admin' || role === 'supervisor';
}

// POST /api/supervisor/evaluator-tracks
// Body: { evaluator_id, track_id, action: 'assign' | 'unassign' }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !guard(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const evaluator_id = String(body?.evaluator_id ?? '').trim();
  const track_id = String(body?.track_id ?? '').trim();
  const action = String(body?.action ?? '').trim();
  if (!evaluator_id || !track_id || (action !== 'assign' && action !== 'unassign')) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (action === 'assign') {
    const { error } = await admin
      .from('evaluator_track_assignments')
      .upsert(
        { evaluator_id, track_id, assigned_by: user.id, assigned_at: new Date().toISOString() },
        { onConflict: 'evaluator_id,track_id' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from('evaluator_track_assignments')
      .delete()
      .eq('evaluator_id', evaluator_id)
      .eq('track_id', track_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
