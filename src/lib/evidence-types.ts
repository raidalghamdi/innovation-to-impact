// Shared evidence types + constants. Kept in a non-'use server' module so it
// can be imported from client components (evidence-uploader.tsx) and server
// modules alike. The mutating helpers live in `@/lib/storage`.

export const EVIDENCE_BUCKET = 'evidence';

export type EvidenceContext =
  | 'idea_submission'
  | 'evaluation'
  | 'committee'
  | 'compliance'
  | 'implementation';

export type EntityRef = {
  ideaId?: string | null;
  entityType: string;
  entityId: string;
};

export type EvidenceRow = {
  id: string;
  idea_id: string | null;
  uploader_id: string | null;
  storage_path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  context: EvidenceContext;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  uploaded_at: string;
};

// `url` opens/previews inline (images, PDFs) in a new tab; `downloadUrl`
// carries a Content-Disposition: attachment hint so an explicit Download
// button always forces a save regardless of the file type.
export type EvidenceWithUrl = EvidenceRow & {
  url: string | null;
  downloadUrl: string | null;
};

export type UploadResult = { ok: boolean; row?: EvidenceRow; error?: string };

// Human-readable file size with adaptive units. Fixes the "0 KB" / "0.0 MB"
// display bug where small files were always rendered in megabytes and rounded
// away to zero.
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
