import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { logAudit } from '@/lib/audit';
import { findDuplicates, type DuplicateInput } from '@/lib/similarity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/ideas/duplicate-check — authenticated.
// Two modes:
//   default            → { title_ar?, title_en?, description?, excludeId? }
//                         returns { duplicates: DuplicateCandidate[] }
//   { dismissed: true, candidates } → records that the author saw duplicates and
//                         chose to proceed (audit trail), returns { ok: true }.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: (DuplicateInput & { dismissed?: boolean; candidates?: unknown[] }) | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  if (body.dismissed) {
    await logAudit(user.id, 'idea.duplicate_check_dismissed', 'idea', body.excludeId ?? null, {
      after: { candidates: (body.candidates ?? []).slice(0, 5) },
    });
    return NextResponse.json({ ok: true });
  }

  const duplicates = await findDuplicates({
    title_ar: body.title_ar ?? null,
    title_en: body.title_en ?? null,
    description: body.description ?? null,
    excludeId: body.excludeId ?? null,
  });
  return NextResponse.json({ duplicates });
}
