'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';

export type SignResult = { ok: boolean; error?: string };

const IP_TERMS_VERSION = 'v1';

export async function signIpTerms(ideaId: string): Promise<SignResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.from('ip_signatures').insert({
    idea_id: ideaId,
    user_id: user.id,
    ip_terms_version: IP_TERMS_VERSION,
  });

  if (error) {
    // Unique violation → already signed, treat as success (idempotent).
    if ((error as { code?: string }).code === '23505') {
      return { ok: true };
    }
    // eslint-disable-next-line no-console
    console.error('[signIpTerms] insert error:', error);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/[locale]/ideas/${ideaId}/ip-sign`, 'page');
  return { ok: true };
}
