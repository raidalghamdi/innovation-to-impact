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

export type EvidenceWithUrl = EvidenceRow & { url: string | null };

export type UploadResult = { ok: boolean; row?: EvidenceRow; error?: string };
