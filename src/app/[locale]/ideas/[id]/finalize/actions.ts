'use server';

// Server actions for the post-pass finalize flow (Transition T2 prep). The
// innovator, after their idea passed evaluation, uploads the mandatory
// supporting attachments here; the "Submit to Committee" route then verifies at
// least one live `post_pass` attachment exists before flipping the status.
//
// Uploads are written directly with the service-role client so the row can
// carry attachment_type='post_pass' (uploadEvidence does not set that column).
// Every write is gated on ownership + status='pass_awaiting_attachments'.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/user';
import { EVIDENCE_BUCKET, validateUploadFile } from '@/lib/evidence-types';

export type PostPassResult = { ok: boolean; count?: number; error?: string };

// Strip path separators so a filename can never escape its prefix. Mirrors the
// safeName helper in src/lib/storage.ts.
function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file';
}

async function assertOwnerAwaiting(
  ideaId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: idea, error } = await supabase
    .from('ideas')
    .select('id, submitter_id, status')
    .eq('id', ideaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!idea) return { ok: false, error: 'not_found' };

  const row = idea as { submitter_id: string | null; status: string | null };
  if (row.submitter_id !== user.id) return { ok: false, error: 'not_owner' };
  if (row.status !== 'pass_awaiting_attachments') {
    return { ok: false, error: 'invalid_state' };
  }
  return { ok: true, userId: user.id };
}

export async function persistPostPassAttachments(
  ideaId: string,
  formData: FormData
): Promise<PostPassResult> {
  if (!ideaId) return { ok: false, error: 'missing_id' };

  const gate = await assertOwnerAwaiting(ideaId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'not_configured' };

  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: 'no_file' };

  for (const file of files) {
    const invalid = validateUploadFile(file);
    if (invalid) return { ok: false, error: invalid };

    const filename = safeName(file.name);
    const path = `ideas/${ideaId}/post_pass/${Date.now()}_${filename}`;

    const { error: upErr } = await admin.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) {
      // eslint-disable-next-line no-console
      console.error('[persistPostPassAttachments] storage error:', upErr);
      return { ok: false, error: upErr.message };
    }

    const { error: insErr } = await admin.from('evidence_attachments').insert({
      idea_id: ideaId,
      uploader_id: gate.userId,
      storage_path: path,
      filename,
      content_type: file.type || null,
      size_bytes: file.size,
      context: 'post_pass',
      linked_entity_type: 'idea',
      linked_entity_id: ideaId,
      attachment_type: 'post_pass',
    });
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error('[persistPostPassAttachments] insert error:', insErr);
      // Roll the orphaned object back so a failed insert never leaks storage.
      await admin.storage.from(EVIDENCE_BUCKET).remove([path]);
      return { ok: false, error: insErr.message };
    }
  }

  revalidatePath(`/[locale]/ideas/${ideaId}/finalize`, 'page');
  const count = await countPostPassAttachments(ideaId);
  return { ok: true, count };
}

export async function countPostPassAttachments(ideaId: string): Promise<number> {
  if (!ideaId) return 0;
  const supabase = await createClient();
  if (!supabase) return 0;
  try {
    const { count, error } = await supabase
      .from('evidence_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('idea_id', ideaId)
      .eq('attachment_type', 'post_pass')
      .is('deleted_at', null);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[countPostPassAttachments] select error:', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[countPostPassAttachments] threw:', err);
    return 0;
  }
}
