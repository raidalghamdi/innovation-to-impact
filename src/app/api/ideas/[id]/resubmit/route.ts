import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { fanOut } from '@/lib/notifications';

/**
 * POST /api/ideas/[id]/resubmit
 *
 * Innovator submits partial edits after a supervisor returned their idea.
 * Body: { title_ar?, title_en?, problem_statement?, proposed_solution?, expected_benefits? }
 *
 * Server-side gate (defense in depth against a client hack):
 *  1) Caller must be the idea's submitter.
 *  2) Idea must currently be in `returned` (or `draft` for first-time saves).
 *  3) Only keys whose section is in `editable_sections` are applied. Unauthorized
 *     keys are silently dropped.
 *  4) On success: status flips back to `screening`, `submitted_at` refreshes,
 *     and `editable_sections` is cleared. Supervisor is notified.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'db_unavailable' }, { status: 500 });

  // Fetch the idea to verify ownership + status + editable_sections gate.
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('id, code, submitter_id, status, editable_sections, strategic_theme_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  if (!idea) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = idea as {
    id: string;
    code: string | null;
    submitter_id: string | null;
    status: string | null;
    editable_sections: string[] | null;
    strategic_theme_id: string | null;
  };

  if (row.submitter_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (row.status !== 'returned' && row.status !== 'draft') {
    return NextResponse.json(
      { error: 'invalid_state', current: row.status },
      { status: 409 }
    );
  }

  // Map body keys → the section that governs them. If a key's section isn't
  // in editable_sections, drop it silently.
  const SECTION_FOR_KEY: Record<string, string> = {
    title_ar: 'title',
    title_en: 'title',
    problem_statement: 'problem_statement',
    proposed_solution: 'proposed_solution',
    expected_benefits: 'expected_benefits',
  };

  // editable_sections === null → legacy behavior, all sections editable.
  const openAll = !Array.isArray(row.editable_sections) || row.editable_sections.length === 0;
  const allow = new Set(row.editable_sections ?? []);

  const patch: Record<string, unknown> = {};
  for (const [key, section] of Object.entries(SECTION_FOR_KEY)) {
    if (!(key in body)) continue;
    if (!openAll && !allow.has(section)) continue;
    const v = body[key];
    if (typeof v === 'string' || v === null) patch[key] = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_editable_fields' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update = {
    ...patch,
    status: 'screening',
    submitted_at: now,
    updated_at: now,
    editable_sections: null,
    // Clear supervisor's prior rejection notes so the next return starts clean.
    rejection_reason: null,
    rejection_reason_ar: null,
  };

  const { error: upErr } = await supabase.from('ideas').update(update).eq('id', id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Notify supervisors so they know an updated idea is ready for re-screening.
  // Best-effort — never fail the request on notification errors.
  try {
    // Resolve supervisor user IDs via user_roles ⇄ roles (schema 'innovation').
    // `notifyByRole` in this project only supports a narrow Role union, so we
    // fan out to explicit IDs to reach the 'supervisor' role.
    const { data: supRoleRow } = await supabase
      .from('roles')
      .select('id')
      .eq('code', 'supervisor')
      .maybeSingle();
    const supRoleId = (supRoleRow as { id?: string } | null)?.id ?? null;
    if (supRoleId) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', supRoleId);
      const ids = ((userRoles as { user_id: string }[] | null) ?? [])
        .map((r) => r.user_id)
        .filter(Boolean);
      if (ids.length) {
        await fanOut(
          ids,
          'idea_feedback_requested',
          { ideaId: id, ideaCode: row.code ?? id, reason: 'resubmitted_by_innovator' },
          { link: `/supervisor` }
        );
      }
    }
  } catch (e) {
    console.error('[resubmit] notify supervisor failed:', e);
  }

  return NextResponse.json({ ok: true, status: 'screening' });
}
