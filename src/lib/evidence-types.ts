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

// Hard per-file upload ceiling. Enforced on the client (pre-check) AND the
// server (re-check) so the limit can never be bypassed by a crafted request.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Codes returned by validateUploadFile — each maps to an `errors.<code>` i18n
// key so client and server surface the same localized message.
export type UploadValidationCode = 'fileEmpty' | 'fileTooLarge' | 'fileTypeNotAllowed';

// Whitelisted upload types: MIME → allowed file extensions. Anything not listed
// (.zip, .exe, .bat, .sh, .js, .html, …) is rejected. Kept as the single source
// of truth for both the browser `accept` hint and server-side validation.
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
};

export const ALLOWED_UPLOAD_EXTENSIONS: string[] = Array.from(
  new Set(Object.values(ALLOWED_UPLOAD_TYPES).flat())
);

// Value for an <input type="file"> accept attribute — both MIME types and
// extensions so the OS picker filters to allowed files up front.
export const UPLOAD_ACCEPT_ATTR: string = [
  ...Object.keys(ALLOWED_UPLOAD_TYPES),
  ...ALLOWED_UPLOAD_EXTENSIONS,
].join(',');

// MIME values browsers emit when they cannot identify a file. When one of these
// is reported we fall back to extension-only validation instead of rejecting —
// browsers frequently send an empty/generic MIME for Office documents.
const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

// Single source of truth for upload validation, imported by every entry point
// (evidence uploader, idea submit/edit forms, and their server actions) so the
// size/type rules can never drift between client and server.
export function validateUploadFile(file: {
  name: string;
  size: number;
  type?: string | null;
}): UploadValidationCode | null {
  if (file.size === 0) return 'fileEmpty';
  if (file.size > MAX_UPLOAD_BYTES) return 'fileTooLarge';

  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  // Extension must always be on the whitelist.
  if (!ext || !ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) return 'fileTypeNotAllowed';
  // When a specific MIME is reported it must match the extension's allowed set.
  const mime = (file.type ?? '').toLowerCase();
  if (!GENERIC_MIME.has(mime)) {
    const exts = ALLOWED_UPLOAD_TYPES[mime];
    if (!exts || !exts.includes(ext)) return 'fileTypeNotAllowed';
  }
  return null;
}

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
