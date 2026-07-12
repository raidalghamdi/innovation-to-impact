'use server';

import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';

// Audit a CMS content save (Missing 1.2). The editor writes cms_blocks directly
// from the browser client; this server action gives the privileged edit an
// audit trail without changing the save path. Best-effort — logAudit never
// throws, so a logging hiccup can't disturb the save UX.
export async function logCmsSave(
  page: string,
  changedKeys: string[]
): Promise<void> {
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, 'cms.updated', 'cms_block', page, {
    after: { page, changedKeys, count: changedKeys.length },
  });
}
