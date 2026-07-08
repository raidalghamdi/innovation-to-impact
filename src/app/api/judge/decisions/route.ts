import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { userHasRole } from '@/lib/user-role-check';

type Decision = 'approve' | 'reject';

/**
 * POST /api/judge/decisions
 * Body: { idea_id, decision: 'approve'|'reject', score?: number|null, note_ar?, note_en? }
 *
 * Judge (or committee) final decision on ideas in status='committee'.
 * Approve → ideas.status='approved' + committee_decisions row
 * Reject  → ideas.status='rejected' + committee_decisions row
 *
 * The score is stored inside committee_decisions.attachments (jsonb) so the
 * decisions table stays enum-clean while still capturing the judge's number.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const isJudge = await userHasRole(user.id, 'judge');
  const isCommittee = await userHasRole(user.id, 'committee');
  if (!isJudge && !isCommittee && user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    idea_id?: string;
    decision?: Decision;
    score?: number | null;
    note_ar?: string | null;
    note_en?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const { idea_id, decision, score = null, note_ar = null, note_en = null } = body;
  if (!idea_id) {
    return NextResponse.json({ error: 'missing_idea_id' }, { status: 400 });
  }
  if (!decision || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 });
  }
  if (score !== null && score !== undefined) {
    if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'invalid_score' }, { status: 400 });
    }
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  // Build combined comments (AR + EN) so the existing text column captures both.
  const commentParts: string[] = [];
  if (note_ar) commentParts.push(note_ar);
  if (note_en) commentParts.push(note_en);
  const comments = commentParts.join('\n\n---\n\n') || null;

  // Store the judge's final score inside attachments so we don't need a new column.
  const attachments = score !== null && score !== undefined ? [{ kind: 'judge_score', score }] : [];

  const { error: insErr } = await supabase.from('committee_decisions').insert({
    idea_id,
    decision,
    quorum_met: true,
    committee_name: 'judge',
    comments,
    attachments,
    decided_by: user.id,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // Advance the idea's status.
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (decision === 'approve') update.approved_at = new Date().toISOString();

  const { error: updErr } = await supabase.from('ideas').update(update).eq('id', idea_id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  // Best-effort audit
  await supabase
    .from('audit_logs')
    .insert({
      actor_id: user.id,
      action: `judge.${decision}`,
      entity_type: 'idea',
      entity_id: idea_id,
      metadata: { score, note_ar, note_en },
    })
    .then(
      () => undefined,
      () => undefined
    );

  return NextResponse.json({ ok: true, status: nextStatus });
}
