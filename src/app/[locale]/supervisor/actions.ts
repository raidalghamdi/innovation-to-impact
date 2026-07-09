'use server';

import { listEvidence } from '@/lib/storage';

export type SupervisorAttachment = {
  id: string;
  filename: string;
  url: string | null;
  size_bytes: number | null;
  content_type: string | null;
};

/**
 * Fetch an idea's attachments (with fresh signed URLs) for the supervisor
 * review modal. Called on demand when the modal opens so URLs stay valid.
 */
export async function getIdeaAttachments(ideaId: string): Promise<SupervisorAttachment[]> {
  if (!ideaId) return [];
  const rows = await listEvidence('idea', ideaId);
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    url: r.url ?? null,
    size_bytes: typeof r.size_bytes === 'number' ? r.size_bytes : null,
    content_type: r.content_type ?? null,
  }));
}
