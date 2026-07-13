import type { SupabaseClient } from '@supabase/supabase-js';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { sendTransactional } from '@/lib/email';
import { sendNotificationMessage } from '@/lib/messaging';
import type { Role } from '@/lib/roles';
import { listUserIdsByRole } from '@/lib/user-roles';

// Notification kinds. Bilingual copy for each lives in messages/*.json under
// `notifications.types.<type>.{title,body}` and is resolved via next-intl.
export type NotificationType =
  | 'idea_submitted'
  | 'idea_submitted_confirmation'
  | 'evaluation_assigned'
  | 'evaluation_completed'
  | 'committee_decision'
  | 'idea_feedback_requested'
  | 'idea_approved'
  | 'idea_rejected'
  | 'deadline_approaching'
  | 'sla_breached'
  | 'escalation'
  | 'approval_requested';

// Arbitrary values interpolated into the bilingual copy AND persisted verbatim
// in the notifications.payload jsonb column (e.g. { subject, ideaId, hours }).
export type NotificationPayload = Record<string, string | number | boolean | null>;

export type NotifyOptions = {
  // Also deliver by email (default false — in-app only).
  email?: boolean;
  // Optional privileged client for session-less callers (cron / fan-out jobs).
  client?: SupabaseClient<any, any, any>;
  // Deep link stored on the row for the in-app list.
  link?: string;
};

// Loose generics so both the RLS-scoped session client and the service-role
// admin client (schema 'innovation') are assignable.
type Client = SupabaseClient<any, any, any>;

async function resolveClient(client?: Client): Promise<Client | null> {
  if (client) return client;
  return (await createClient()) as Client | null;
}

// Look up recipient email + preferred locale for email delivery.
async function recipientContact(
  supabase: Client,
  userId: string
): Promise<{ email: string | null; phone: string | null; locale: 'ar' | 'en' }> {
  const { data } = await supabase
    .from('user_profiles')
    .select('email, phone, language_preference')
    .eq('id', userId)
    .maybeSingle();
  const row = data as {
    email?: string | null;
    phone?: string | null;
    language_preference?: string | null;
  } | null;
  return {
    email: row?.email ?? null,
    phone: row?.phone ?? null,
    locale: row?.language_preference === 'ar' ? 'ar' : 'en',
  };
}

type Copy = { title_ar: string; title_en: string; body_ar: string; body_en: string };

// Resolve the bilingual title/body for a notification type, interpolating the
// payload as ICU variables. Falls back to the type key if a message is missing.
async function resolveCopy(type: NotificationType, payload: NotificationPayload): Promise<Copy> {
  const vars = payload as Record<string, string | number | boolean>;
  const [ar, en] = await Promise.all([
    getTranslations({ locale: 'ar', namespace: 'notifications.types' }),
    getTranslations({ locale: 'en', namespace: 'notifications.types' }),
  ]);
  return {
    title_ar: ar(`${type}.title`, vars),
    title_en: en(`${type}.title`, vars),
    body_ar: ar(`${type}.body`, vars),
    body_en: en(`${type}.body`, vars),
  };
}

/**
 * Insert a single in-app notification and, when opts.email is true, dispatch a
 * transactional email to the recipient in their preferred language. Best-effort:
 * swallows all errors so it can never break the action that triggered it.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload = {},
  opts: NotifyOptions = {}
): Promise<void> {
  try {
    const supabase = await resolveClient(opts.client);
    if (!supabase) return;

    const copy = await resolveCopy(type, payload);

    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title_ar: copy.title_ar,
      title_en: copy.title_en,
      body_ar: copy.body_ar,
      body_en: copy.body_en,
      payload,
      link: opts.link ?? null,
    });

    // Look up email + phone + locale once, reuse for both channels.
    const contact = await recipientContact(supabase, userId);

    if (opts.email && contact.email) {
      await sendTransactional({
        to: contact.email,
        subject_ar: copy.title_ar,
        subject_en: copy.title_en,
        body_ar: copy.body_ar,
        body_en: copy.body_en,
        locale: contact.locale,
      });
    }

    // WhatsApp delivery is best-effort and fully gated by platform_settings
    // (whatsapp_enabled + whatsapp_channels.notifications). It never throws.
    if (contact.phone) {
      await sendNotificationMessage({
        phoneE164: contact.phone,
        titleAr: copy.title_ar,
        titleEn: copy.title_en,
        bodyAr: copy.body_ar,
        bodyEn: copy.body_en,
        locale: contact.locale,
        link: opts.link ?? null,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[createNotification] failed:', err);
  }
}

/**
 * Fan a single notification out to many recipients. De-duplicates ids and reuses
 * one client so a batch is a handful of queries, not one per user.
 */
export async function fanOut(
  userIds: string[],
  type: NotificationType,
  payload: NotificationPayload = {},
  opts: NotifyOptions = {}
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  const supabase = await resolveClient(opts.client);
  if (!supabase) return;
  await Promise.all(
    unique.map((id) => createNotification(id, type, payload, { ...opts, client: supabase }))
  );
}

/**
 * Resolve the user_ids of everyone holding the `supervisor` role.
 *
 * Supervisors live in the canonical multi-role source (`v_user_roles`), NOT
 * reliably in `user_profiles.role` (which is frequently stale/'member' for
 * supervisors). We read the view first and fall back to the legacy column so
 * the helper still returns recipients on installs where the view is empty.
 */
export async function getSupervisorIds(client?: Client): Promise<string[]> {
  const supabase = await resolveClient(client);
  if (!supabase) return [];
  return listUserIdsByRole(supabase, 'supervisor');
}

// Events that concern the supervisor(s) overseeing screening. Every one of
// these should always reach supervisors in addition to their primary audience.
const SUPERVISOR_EVENTS = new Set<NotificationType>([
  'idea_submitted',
  'idea_approved',
  'idea_rejected',
  'idea_feedback_requested',
  'committee_decision',
  'evaluation_completed',
  'escalation',
  'sla_breached',
]);

/**
 * Return the set of user_ids that should receive a notification for an event.
 *
 * `primary` is the event's direct audience (e.g. the idea submitter, assigned
 * evaluators). Supervisors are appended automatically for the events in
 * SUPERVISOR_EVENTS so no call site can forget them. De-duplicated.
 */
export async function getNotificationRecipients(
  type: NotificationType,
  primary: string[],
  client?: Client
): Promise<string[]> {
  const ids = [...primary.filter(Boolean)];
  if (SUPERVISOR_EVENTS.has(type)) {
    ids.push(...(await getSupervisorIds(client)));
  }
  return Array.from(new Set(ids));
}

/**
 * Notify every user holding a given role, resolving recipients from the role
 * source of truth (innovation.v_user_roles). Used for role-addressed events
 * (e.g. notify all judges when an evaluation is submitted).
 */
export async function notifyByRole(
  role: Role,
  type: NotificationType,
  payload: NotificationPayload = {},
  opts: NotifyOptions = {}
): Promise<void> {
  const supabase = await resolveClient(opts.client);
  if (!supabase) return;
  const ids = await listUserIdsByRole(supabase, role);
  await fanOut(ids, type, payload, { ...opts, client: supabase });
}
