/**
 * Invitations service — CRUD + email flow for role-based invitations.
 */
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Non-null wrapper for the admin client. Every function in this module
 * requires the service role key at runtime — fail fast with a clear message
 * rather than let TypeScript blame each individual chained call.
 */
function createServiceRoleClient() {
  const c = createAdminClient();
  if (!c) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return c;
}
import { sendMail, renderMailHtml, renderTemplate, type MailAttachment } from '@/lib/mailer';

export type RoleCode =
  | 'innovator'
  | 'supervisor'
  | 'expert'
  | 'committee'
  | 'judge'
  | 'admin'
  | 'mentor';

export type InvitationStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'withdrawn';

export type TemplateKind = 'invite' | 'accept' | 'reject' | 'reminder';

export type Invitation = {
  id: string;
  token: string;
  role: RoleCode;
  target_email: string;
  target_name: string | null;
  target_user_id: string | null;
  status: InvitationStatus;
  deadline_at: string | null;
  responded_at: string | null;
  response_note: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  sent_at: string | null;
  sent_by: string | null;
  campaign_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EmailTemplate = {
  id: string;
  code: string;
  kind: TemplateKind;
  role: RoleCode;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  is_active: boolean;
  updated_at: string;
};

export type TemplateAttachment = {
  id: string;
  template_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

// ---------- Template helpers -------------------------------------------------

export async function getTemplateForRole(
  role: RoleCode,
  kind: TemplateKind
): Promise<EmailTemplate | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('email_templates')
    .select('*')
    .eq('role', role)
    .eq('kind', kind)
    .eq('is_active', true)
    .maybeSingle();
  return (data as EmailTemplate | null) ?? null;
}

export async function getTemplateAttachments(templateId: string): Promise<TemplateAttachment[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('email_template_attachments')
    .select('*')
    .eq('template_id', templateId);
  return (data as TemplateAttachment[] | null) ?? [];
}

async function downloadAttachments(
  attachments: TemplateAttachment[]
): Promise<MailAttachment[]> {
  const supabase = createServiceRoleClient();
  const out: MailAttachment[] = [];
  for (const a of attachments) {
    try {
      const { data, error } = await supabase.storage
        .from('template-attachments')
        .download(a.storage_path);
      if (error || !data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      out.push({
        filename: a.file_name,
        content: buffer,
        contentType: a.mime_type ?? undefined,
      });
    } catch {
      // Skip missing attachments — never block the whole email
    }
  }
  return out;
}

// ---------- Settings ---------------------------------------------------------

export async function getAdminSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

// ---------- Create + send ----------------------------------------------------

export async function createInvitations(input: {
  role: RoleCode;
  targets: Array<{ email: string; name?: string; user_id?: string | null }>;
  deadline_at?: string | null;
  sent_by?: string | null;
}): Promise<Invitation[]> {
  const supabase = createServiceRoleClient();
  const defaults = await getAdminSetting<{ expires_days: number }>('invitation_defaults');
  const expiresDays = defaults?.expires_days ?? 14;
  const deadline =
    input.deadline_at ??
    new Date(Date.now() + expiresDays * 24 * 3600 * 1000).toISOString();

  const rows = input.targets.map((t) => ({
    role: input.role,
    target_email: t.email.trim().toLowerCase(),
    target_name: t.name ?? null,
    target_user_id: t.user_id ?? null,
    deadline_at: deadline,
    sent_by: input.sent_by ?? null,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .schema('innovation')
    .from('invitations')
    .insert(rows)
    .select('*');
  if (error) throw error;
  return (data as Invitation[]) ?? [];
}

function inviteLink(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://innovation-to-impact.vercel.app';
  return `${base}/invitations/${token}`;
}

function formatDate(iso: string | null, locale: 'ar' | 'en'): string {
  if (!iso) return locale === 'ar' ? 'غير محدد' : 'Not set';
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function sendInvitationEmail(
  invitation: Invitation,
  opts: { locale?: 'ar' | 'en'; kind?: TemplateKind } = {}
): Promise<{ ok: boolean; provider: string; error?: string }> {
  const kind = opts.kind ?? 'invite';
  const locale = opts.locale ?? 'ar';
  const template = await getTemplateForRole(invitation.role, kind);
  if (!template) return { ok: false, provider: 'noop', error: 'template_not_found' };

  const defaults = await getAdminSetting<{
    program_name_ar: string;
    program_name_en: string;
  }>('invitation_defaults');
  const programName =
    locale === 'ar'
      ? defaults?.program_name_ar ?? 'برنامج ابتكر لمنافس'
      : defaults?.program_name_en ?? 'Innovation-to-Impact Program';

  const vars = {
    name: invitation.target_name ?? invitation.target_email,
    role: invitation.role,
    link: inviteLink(invitation.token),
    deadline: formatDate(invitation.deadline_at, locale),
    program: programName,
  };

  const subject = renderTemplate(
    locale === 'ar' ? template.subject_ar : template.subject_en,
    vars
  );
  const bodyText = renderTemplate(
    locale === 'ar' ? template.body_ar : template.body_en,
    vars
  );
  const html = renderMailHtml({ subject, body: bodyText, locale });

  const attachmentRows = await getTemplateAttachments(template.id);
  const attachments = await downloadAttachments(attachmentRows);

  const result = await sendMail({
    to: invitation.target_email,
    subject,
    html,
    text: bodyText,
    attachments,
  });

  // Log event
  const supabase = createServiceRoleClient();
  await supabase
    .schema('innovation')
    .from('invitation_events')
    .insert({
      invitation_id: invitation.id,
      event_type: result.ok ? 'sent' : 'delivery_failed',
      detail: { provider: result.provider, error: result.error, kind },
    });

  if (result.ok && kind === 'invite') {
    await supabase
      .schema('innovation')
      .from('invitations')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invitation.id);
  }

  return { ok: result.ok, provider: result.provider, error: result.error };
}

// ---------- Respond ----------------------------------------------------------

export async function respondToInvitation(
  token: string,
  decision: 'accepted' | 'declined',
  note?: string,
  actorUserId?: string | null
): Promise<{ ok: boolean; invitation?: Invitation; error?: string }> {
  const supabase = createServiceRoleClient();
  const { data: inv } = await supabase
    .schema('innovation')
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!inv) return { ok: false, error: 'invitation_not_found' };
  const invitation = inv as Invitation;

  if (invitation.status === 'expired' || invitation.status === 'withdrawn') {
    return { ok: false, error: `invitation_${invitation.status}` };
  }

  const { data: updated } = await supabase
    .schema('innovation')
    .from('invitations')
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      response_note: note ?? null,
      target_user_id: actorUserId ?? invitation.target_user_id,
    })
    .eq('id', invitation.id)
    .select('*')
    .single();

  const followupKind: TemplateKind = decision === 'accepted' ? 'accept' : 'reject';
  await sendInvitationEmail(updated as Invitation, { kind: followupKind });

  return { ok: true, invitation: updated as Invitation };
}

// ---------- Reminders --------------------------------------------------------

export async function sendReminder(invitationId: string): Promise<{ ok: boolean }> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .maybeSingle();
  if (!data) return { ok: false };
  const invitation = data as Invitation;
  if (invitation.status !== 'sent' && invitation.status !== 'viewed') {
    return { ok: false };
  }

  const result = await sendInvitationEmail(invitation, { kind: 'reminder' });

  await supabase
    .schema('innovation')
    .from('invitations')
    .update({
      reminder_count: invitation.reminder_count + 1,
      last_reminder_at: new Date().toISOString(),
    })
    .eq('id', invitationId);

  await supabase
    .schema('innovation')
    .from('invitation_events')
    .insert({
      invitation_id: invitationId,
      event_type: 'reminded',
      detail: { provider: result.provider },
    });

  return { ok: result.ok };
}

// ---------- Bulk helpers -----------------------------------------------------

export async function listInvitationsForRole(role: RoleCode): Promise<Invitation[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('invitations')
    .select('*')
    .eq('role', role)
    .order('created_at', { ascending: false });
  return (data as Invitation[]) ?? [];
}

export async function listUsersForRole(
  role: RoleCode
): Promise<Array<{ user_id: string; email: string; name: string | null }>> {
  const supabase = createServiceRoleClient();
  // Users with role via user_roles → roles
  const { data: roleRow } = await supabase
    .schema('innovation')
    .from('roles')
    .select('id')
    .eq('code', role)
    .maybeSingle();
  if (!roleRow) return [];
  const roleId = (roleRow as { id: string }).id;

  const { data: userRoles } = await supabase
    .schema('innovation')
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId);
  if (!userRoles || userRoles.length === 0) return [];

  const userIds = (userRoles as Array<{ user_id: string }>).map((r) => r.user_id);
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const list = users?.users ?? [];
  return list
    .filter((u) => userIds.includes(u.id))
    .map((u) => ({
      user_id: u.id,
      email: u.email ?? '',
      name:
        (u.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
        (u.user_metadata as { name?: string } | undefined)?.name ??
        null,
    }));
}
