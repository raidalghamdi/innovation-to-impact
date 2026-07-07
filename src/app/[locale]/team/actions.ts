'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { enqueueEmail, renderBilingualEmailHtml } from '@/lib/email-outbox';
import { headers } from 'next/headers';

export type ActionResult = { ok: boolean; error?: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || `team-${Date.now()}`;
}

export async function createTeam(formData: FormData): Promise<ActionResult> {
  const nameAr = String(formData.get('name_ar') ?? '').trim();
  const nameEn = String(formData.get('name_en') ?? '').trim() || null;
  if (!nameAr) return { ok: false, error: 'missing_name' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Guard: a user is only expected to belong to a single team. If they already
  // have a membership, treat re-submission as a no-op success — without this,
  // clicking "create" again would spawn duplicate teams (each team gets its
  // own leader row via a DB trigger).
  const { data: existing } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    revalidatePath('/[locale]/team', 'page');
    return { ok: true };
  }

  const { error } = await supabase.from('teams').insert({
    name_ar: nameAr,
    name_en: nameEn,
    slug: slugify(nameEn || nameAr),
    leader_id: user.id,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[createTeam] insert error:', error);
    return { ok: false, error: error.message };
  }

  revalidatePath('/[locale]/team', 'page');
  return { ok: true };
}

export async function inviteMember(teamId: string, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid_email' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: inserted, error } = await supabase
    .from('team_invitations')
    .insert({ team_id: teamId, invited_email: email, invited_by: user.id })
    .select('token')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inviteMember] insert error:', error);
    return { ok: false, error: error.message };
  }

  const token = (inserted as { token?: string } | null)?.token;
  if (token) {
    const hdrs = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${hdrs.get('host') ?? ''}`;
    const link = `${origin}/invite/${token}`;
    await enqueueEmail({
      to: email,
      subject: 'دعوة للانضمام إلى فريق · Team invitation',
      category: 'team_invite',
      bodyHtml: renderBilingualEmailHtml({
        titleAr: 'دعوة للانضمام إلى فريق',
        titleEn: 'Team invitation',
        bodyHtmlAr: `تمت دعوتك للانضمام إلى فريق في منصة i2i. اضغط على الزر أدناه لقبول الدعوة.`,
        bodyHtmlEn: `You have been invited to join a team on the i2i platform. Click below to accept the invitation.`,
        ctaHref: link,
        ctaLabelAr: 'عرض الدعوة',
        ctaLabelEn: 'View invitation',
      }),
      metadata: { teamId, token },
    });
  }

  revalidatePath('/[locale]/team', 'page');
  return { ok: true };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/[locale]/team', 'page');
  return { ok: true };
}

export async function removeMember(teamId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const current = await getCurrentUser();
  if (!current) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/[locale]/team', 'page');
  return { ok: true };
}

export async function leaveTeam(teamId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/[locale]/team', 'page');
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: invite, error: fetchErr } = await supabase
    .from('team_invitations')
    .select('id, team_id, invited_email, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (fetchErr || !invite) return { ok: false, error: 'not_found' };
  const row = invite as {
    id: string;
    team_id: string;
    invited_email: string;
    status: string;
    expires_at: string;
  };
  if (row.status !== 'pending') return { ok: false, error: 'not_pending' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'expired' };
  if (row.invited_email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return { ok: false, error: 'wrong_account' };
  }

  const { error: memberErr } = await supabase
    .from('team_members')
    .insert({ team_id: row.team_id, user_id: user.id, role: 'member' });
  if (memberErr) return { ok: false, error: memberErr.message };

  await supabase
    .from('team_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', row.id);

  revalidatePath('/[locale]/team', 'page');
  revalidatePath('/[locale]/invite/[token]', 'page');
  return { ok: true };
}

export async function declineInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: invite } = await supabase
    .from('team_invitations')
    .select('id, invited_email, status')
    .eq('token', token)
    .maybeSingle();
  if (!invite) return { ok: false, error: 'not_found' };
  const row = invite as { id: string; invited_email: string; status: string };
  if (row.invited_email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return { ok: false, error: 'wrong_account' };
  }

  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'declined' })
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]/invite/[token]', 'page');
  return { ok: true };
}
