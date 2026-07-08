import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const isSupervisor = await userHasRole(user.id, 'supervisor');
  if (!isSupervisor && user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { user };
}

/**
 * POST body { themeId, evaluatorIds: string[], notes? }
 * Creates one row per (theme, evaluator). Uses upsert to be idempotent —
 * re-assigning an existing pair just refreshes the status back to 'active'.
 */
export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { themeId?: string; evaluatorIds?: string[]; notes?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { themeId, evaluatorIds, notes = null } = body;
  if (!themeId || !Array.isArray(evaluatorIds) || evaluatorIds.length === 0) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  const rows = evaluatorIds.map((evaluator_id) => ({
    theme_id: themeId,
    evaluator_id,
    assigned_by: g.user.id,
    status: 'active',
    notes,
  }));

  const { data, error } = await supabase
    .from('track_assignments')
    .upsert(rows, { onConflict: 'theme_id,evaluator_id' })
    .select('id, theme_id, evaluator_id, status');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

/**
 * DELETE  ?id=<track_assignment_id>
 * Soft-removes a track assignment by flipping status to 'revoked'.
 */
export async function DELETE(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  const { error } = await supabase
    .from('track_assignments')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
