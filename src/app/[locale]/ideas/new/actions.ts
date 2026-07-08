'use server';

import { createClient } from '@/lib/supabase/server';
import { fanOut, getSupervisorIds } from '@/lib/notifications';

/**
 * Notify supervisors that a new idea entered the screening queue.
 *
 * The submit form inserts the idea row client-side, so there is no server
 * insert hook to fan out from. This action is invoked right after a successful
 * insert to alert every supervisor. Best-effort — failures are swallowed so a
 * notification hiccup never blocks the submitter's success flow.
 */
export async function notifySupervisorsOfNewIdea(ideaId: string): Promise<void> {
  if (!ideaId) return;
  try {
    const supabase = await createClient();
    if (!supabase) return;
    const { data: ideaRow } = await supabase
      .from('ideas')
      .select('code')
      .eq('id', ideaId)
      .maybeSingle();
    const ideaCode = (ideaRow as { code?: string } | null)?.code ?? ideaId;
    const supervisorIds = await getSupervisorIds(supabase);
    if (supervisorIds.length === 0) return;
    await fanOut(
      supervisorIds,
      'idea_submitted',
      { ideaId, ideaCode },
      { client: supabase, link: '/supervisor' }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifySupervisorsOfNewIdea] failed:', err);
  }
}
