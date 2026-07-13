import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { fanOut } from '@/lib/notifications';

/**
 * POST /api/ideas/[id]/resubmit
 *
 * Innovator submits partial edits after a supervisor returned their idea.
 * Body: { title_ar?, title_en?, proposed_solution? }
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
    .select('id, code, submitter_id, status, editable_sections, strategic_theme_id, original_source_metadata, participation_type, team_members')
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
    original_source_metadata: Record<string, unknown> | null;
    participation_type: string | null;
    team_members: Array<Record<string, unknown>> | null;
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

  // Map plain string/scalar body keys → the section that governs them. If a
  // key's section isn't in editable_sections, drop it silently.
  const SECTION_FOR_KEY: Record<string, string> = {
    title_ar: 'title',
    title_en: 'title',
    proposed_solution: 'proposed_solution',
    activity_id: 'activity_id',
    strategic_theme_id: 'strategic_theme_id',
    participation_type: 'participation_type',
  };

  // editable_sections === null → legacy behavior, all sections editable.
  const openAll = !Array.isArray(row.editable_sections) || row.editable_sections.length === 0;
  const allow = new Set(row.editable_sections ?? []);
  const sectionOpen = (section: string) => openAll || allow.has(section);

  const patch: Record<string, unknown> = {};
  for (const [key, section] of Object.entries(SECTION_FOR_KEY)) {
    if (!(key in body)) continue;
    if (!sectionOpen(section)) continue;
    const v = body[key];
    if (typeof v === 'string' || v === null) patch[key] = v;
  }

  // Team (name + members array) — governed by the 'team' section.
  if (sectionOpen('team')) {
    if ('team_name' in body) {
      const tn = body.team_name;
      if (typeof tn === 'string' || tn === null) patch.team_name = tn;
    }
    if ('team_members' in body && Array.isArray(body.team_members)) {
      patch.team_members = (body.team_members as Array<Record<string, unknown>>)
        .map((m) => ({
          name: typeof m?.name === 'string' ? m.name.trim() : '',
          email: typeof m?.email === 'string' ? m.email.trim() : '',
        }))
        .filter((m) => m.name || m.email);
    }
  }

  // Challenge — stored inside the original_source_metadata JSONB (no dedicated
  // column), so merge it in rather than replacing the whole object.
  if (sectionOpen('challenge') && 'challenge' in body) {
    const c = body.challenge;
    if (typeof c === 'string' || c === null) {
      const meta =
        row.original_source_metadata && typeof row.original_source_metadata === 'object'
          ? { ...row.original_source_metadata }
          : {};
      meta.challenge = c || null;
      patch.original_source_metadata = meta;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_editable_fields' }, { status: 400 });
  }

  // R42-later Item 4: enforce the minimum team size on resubmission (defense in
  // depth — the form also enforces it). A team idea needs the leader + at least
  // 2 additional members in the JSONB array (leader is not stored in the array,
  // so the array must have >= 2 entries). Use the patched values when present,
  // otherwise fall back to the current row.
  const effectiveType =
    'participation_type' in patch
      ? (patch.participation_type as string | null)
      : row.participation_type;
  if (effectiveType === 'team') {
    const effectiveMembers = Array.isArray(patch.team_members)
      ? (patch.team_members as unknown[])
      : Array.isArray(row.team_members)
        ? row.team_members
        : [];
    if (effectiveMembers.length < 2) {
      return NextResponse.json(
        { error: 'team_min_members', min: 3 },
        { status: 400 }
      );
    }
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
    // R42-later Item 6: back in the screening queue — no longer returned.
    returned_to_innovator: false,
    // R42-later Item 7: keep team_leader_id in sync — leader is the submitter
    // for team ideas, null for individual.
    team_leader_id: effectiveType === 'team' ? row.submitter_id : null,
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
