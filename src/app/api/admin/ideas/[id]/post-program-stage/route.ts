import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/ideas/[id]/post-program-stage  (R43, admin only)
// Body: { stage } where stage is one of in_pilot | in_measurement |
// in_scaling. Manually advances an approved / post-program idea along the
// post-program lifecycle. Updates innovation.ideas.status and records the
// change to status_history on a best-effort basis (table may not exist).

const POST_PROGRAM_STAGES = ['in_pilot', 'in_measurement', 'in_scaling'] as const;
type PostProgramStage = (typeof POST_PROGRAM_STAGES)[number];

function isStage(v: unknown): v is PostProgramStage {
  return typeof v === 'string' && (POST_PROGRAM_STAGES as readonly string[]).includes(v);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const stage = body?.stage;
  if (!isStage(stage)) {
    return NextResponse.json({ error: 'invalid_stage' }, { status: 400 });
  }

  const { data: current } = await admin
    .from('ideas')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const fromStatus = (current as { status: string | null }).status ?? null;

  const now = new Date().toISOString();
  const { error } = await admin
    .from('ideas')
    .update({ status: stage, updated_at: now })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort audit trail — never fail the transition on a history error.
  try {
    await admin.from('status_history').insert({
      idea_id: id,
      from_status: fromStatus,
      to_status: stage,
      changed_by: user.id,
      changed_at: now,
    });
  } catch {
    // status_history table may not exist in this environment — ignore.
  }

  return NextResponse.json({ ok: true, status: stage });
}
