'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';

export type SignResult = { ok: boolean; error?: string };

const IP_TERMS_VERSION = 'v1';

/**
 * Insert an IP terms signature for the current user on the given idea.
 * Returns a plain result — no redirect — for callers that want to handle
 * post-sign UX themselves (e.g. show inline confirmation).
 */
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

/**
 * Same as signIpTerms, but on success redirects (server-side) to the
 * "idea received" confirmation page. Redirecting from the server action
 * ensures Supabase's refreshed auth cookies are attached to the redirect
 * response — without this, a stale cookie can reach the middleware on the
 * next navigation and the user gets bounced back to /login.
 */
export async function signIpTermsAndRedirect(
  ideaId: string,
  locale: string,
): Promise<SignResult> {
  const res = await signIpTerms(ideaId);
  if (!res.ok) return res;
  // Note: redirect() throws internally — execution stops here on success.
  redirect(`/${locale}/ideas/${ideaId}/submitted`);
}
