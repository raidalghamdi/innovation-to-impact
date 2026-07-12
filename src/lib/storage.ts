'use server';

// Evidence upload/read/delete backed by the private `evidence` Supabase Storage
// bucket + the innovation.evidence_attachments ledger (migration 00012).
// Every helper is best-effort against a live Supabase; when env is unset the
// client is null and the helpers return safe empty results so the UI degrades
// gracefully instead of throwing.
//
// Types and constants live in `@/lib/evidence-types` so client components can
// import them without pulling this 'use server' module.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import {
  EVIDENCE_BUCKET,
  type EvidenceContext,
  type EntityRef,
  type EvidenceRow,
  type EvidenceWithUrl,
  type UploadResult,
} from '@/lib/evidence-types';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — mirrors the client-side guard.
const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Strip path separators so a filename can never escape its {uid}/{type}/{id}/
// prefix. Keeps a readable-but-safe basename for the storage key.
function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file';
}

export async function uploadEvidence(
  file: File,
  ctx: EvidenceContext,
  entityRef: EntityRef
): Promise<UploadResult> {
  if (!file) return { ok: false, error: 'no_file' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const filename = safeName(file.name);
  const path = `${user.id}/${entityRef.entityType}/${entityRef.entityId}/${Date.now()}_${filename}`;

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) {
    // eslint-disable-next-line no-console
    console.error('[uploadEvidence] storage error:', upErr);
    return { ok: false, error: upErr.message };
  }

  const { data, error } = await supabase
    .from('evidence_attachments')
    .insert({
      idea_id: entityRef.ideaId ?? null,
      uploader_id: user.id,
      storage_path: path,
      filename,
      content_type: file.type || null,
      size_bytes: file.size,
      context: ctx,
      linked_entity_type: entityRef.entityType,
      linked_entity_id: entityRef.entityId,
    })
    .select('*')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[uploadEvidence] insert error:', error);
    // Roll the orphaned object back so we don't leak storage on a failed insert.
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  await logAudit(user.id, 'evidence.uploaded', entityRef.entityType, entityRef.entityId, {
    after: { filename, size_bytes: file.size, context: ctx },
  });

  return { ok: true, row: data as EvidenceRow };
}

export async function listEvidence(
  entityType: string,
  entityId: string
): Promise<EvidenceWithUrl[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('evidence_attachments')
      .select('*')
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[listEvidence] select error:', error);
      return [];
    }
    const rows = (data as EvidenceRow[]) ?? [];

    // Authorization is already enforced by the RLS-scoped SELECT above: a row
    // is only in `rows` if the current user is allowed to see this idea's
    // evidence. Sign the objects with the service-role client so the signed
    // URL never trips storage.objects RLS — objects submitted at idea time are
    // keyed under `ideas/{ideaId}/…` (not the viewer's uid folder), which the
    // owner-folder read policy would otherwise reject for innovators,
    // evaluators and supervisors. Falls back to the session client when the
    // service-role key is unset (local/preview).
    const signer = createAdminClient() ?? supabase;
    return Promise.all(
      rows.map(async (row) => {
        const bucket = signer.storage.from(EVIDENCE_BUCKET);
        const [{ data: inline }, { data: dl }] = await Promise.all([
          bucket.createSignedUrl(row.storage_path, SIGNED_URL_TTL),
          bucket.createSignedUrl(row.storage_path, SIGNED_URL_TTL, {
            download: row.filename,
          }),
        ]);
        return {
          ...row,
          url: inline?.signedUrl ?? null,
          downloadUrl: dl?.signedUrl ?? inline?.signedUrl ?? null,
        };
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[listEvidence] threw:', err);
    return [];
  }
}

export async function deleteEvidence(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: 'missing_id' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: prior } = await supabase
    .from('evidence_attachments')
    .select('filename, linked_entity_type, linked_entity_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('evidence_attachments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[deleteEvidence] update error:', error);
    return { ok: false, error: error.message };
  }

  const p = prior as { linked_entity_type?: string; linked_entity_id?: string } | null;
  await logAudit(user.id, 'evidence.deleted', p?.linked_entity_type ?? 'evidence', id, {
    before: (prior as Record<string, unknown> | null) ?? null,
  });
  return { ok: true };
}
