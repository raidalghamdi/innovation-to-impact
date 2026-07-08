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
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
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

// ---------- Template-based direct send (Round 3) -----------------------------

export type TemplateRecipient = {
  email: string;
  name?: string | null;
  variable_overrides?: Record<string, string>;
};

export type SendTemplatedResult = {
  ok: boolean;
  campaign_id: string | null;
  sent: number;
  queued: number;
  failed: Array<{ email: string; error: string }>;
};

export async function getTemplateByCode(code: string): Promise<EmailTemplate | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .schema('innovation')
    .from('email_templates')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  return (data as EmailTemplate | null) ?? null;
}

/**
 * Resolve recipient rows from innovation.user_profiles. When `role` is null all
 * profiles are returned (broadcast). `is_active` is intentionally NOT filtered:
 * that column is not guaranteed to exist on user_profiles, and the brief allows
 * skipping the filter when absent.
 */
export async function resolveProfileRecipients(
  role: RoleCode | null
): Promise<TemplateRecipient[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .schema('innovation')
    .from('user_profiles')
    .select('email, full_name, role');
  if (role) query = query.eq('role', role);
  const { data } = await query;
  const rows = (data as Array<{ email: string | null; full_name: string | null }> | null) ?? [];
  const seen = new Set<string>();
  const out: TemplateRecipient[] = [];
  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: r.full_name ?? null });
  }
  return out;
}

/**
 * Send a template to an explicit list of recipients (or all users of a role /
 * everyone). Persists one innovation.invitations row per recipient sharing a
 * campaign_id when bulk (>1). Template-specific fields (template_code, subject,
 * rendered body) are stored in the invitations.metadata JSONB — the repo schema
 * has no dedicated columns for them.
 */
export async function sendTemplatedInvitations(input: {
  template: EmailTemplate;
  recipients: TemplateRecipient[];
  locale?: 'ar' | 'en';
  campaign_id?: string | null;
  sent_by?: string | null;
  subject_override?: string | null;
  body_override?: string | null;
}): Promise<SendTemplatedResult> {
  const supabase = createServiceRoleClient();
  const locale = input.locale ?? 'ar';
  const template = input.template;

  const recipients = input.recipients
    .map((r) => ({
      email: String(r.email ?? '').trim().toLowerCase(),
      name: r.name ?? null,
      variable_overrides: r.variable_overrides ?? {},
    }))
    .filter((r) => r.email);

  if (recipients.length === 0) {
    return { ok: false, campaign_id: null, sent: 0, queued: 0, failed: [] };
  }

  const campaignId =
    recipients.length > 1
      ? input.campaign_id ?? (globalThis.crypto?.randomUUID?.() ?? null)
      : null;

  const defaults = await getAdminSetting<{
    program_name_ar: string;
    program_name_en: string;
    expires_days: number;
  }>('invitation_defaults');
  const programName =
    locale === 'ar'
      ? defaults?.program_name_ar ?? 'برنامج ابتكر لمنافس'
      : defaults?.program_name_en ?? 'Innovation-to-Impact Program';
  const expiresDays = defaults?.expires_days ?? 14;
  const deadline = new Date(Date.now() + expiresDays * 24 * 3600 * 1000).toISOString();

  // template_options may be an array (open-options) or a key/value object; only
  // a plain object contributes {{key}} substitutions.
  const optionVars: Record<string, string> = {};
  const opts = (template as unknown as { template_options?: unknown }).template_options;
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    for (const [k, v] of Object.entries(opts as Record<string, unknown>)) {
      if (v !== null && v !== undefined) optionVars[k] = String(v);
    }
  }

  const subjectTpl =
    input.subject_override ?? (locale === 'ar' ? template.subject_ar : template.subject_en);
  const bodyTpl =
    input.body_override ?? (locale === 'ar' ? template.body_ar : template.body_en);

  const attachmentRows = await getTemplateAttachments(template.id);
  const attachments = await downloadAttachments(attachmentRows);

  const failed: Array<{ email: string; error: string }> = [];
  let sent = 0;
  let queued = 0;

  for (const rec of recipients) {
    const vars: Record<string, string> = {
      name: rec.name ?? rec.email,
      email: rec.email,
      role: template.role,
      program: programName,
      deadline: formatDate(deadline, locale),
      ...optionVars,
      ...rec.variable_overrides,
    };
    const subject = renderTemplate(subjectTpl, vars);
    const bodyText = renderTemplate(bodyTpl, vars);
    const html = renderMailHtml({ subject, body: bodyText, locale });

    const result = await sendMail({
      to: rec.email,
      subject,
      html,
      text: bodyText,
      attachments,
    });

    const status = result.ok ? 'sent' : 'queued';
    if (result.ok) sent += 1;
    else queued += 1;
    if (result.provider === 'resend' && !result.ok && result.error) {
      failed.push({ email: rec.email, error: result.error });
    }

    await supabase
      .schema('innovation')
      .from('invitations')
      .insert({
        role: template.role,
        target_email: rec.email,
        target_name: rec.name,
        deadline_at: deadline,
        sent_by: input.sent_by ?? null,
        campaign_id: campaignId,
        status,
        sent_at: result.ok ? new Date().toISOString() : null,
        metadata: {
          template_code: template.code,
          kind: template.kind,
          subject,
          body_rendered: bodyText,
          created_by: input.sent_by ?? null,
          variable_overrides: rec.variable_overrides,
          provider: result.provider,
        },
      });
  }

  return { ok: sent > 0, campaign_id: campaignId, sent, queued, failed };
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
