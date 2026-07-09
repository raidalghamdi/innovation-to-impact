'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification, fanOut, getSupervisorIds } from '@/lib/notifications';
import { renderMailHtml, sendMail } from '@/lib/mailer';

type Client = SupabaseClient<any, any, any>;

type TeamMember = { name?: string | null; email?: string | null };

type IdeaRow = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  team_name: string | null;
  team_members: TeamMember[] | null;
  submitter_id: string | null;
};

type Locale = 'ar' | 'en';

// Absolute origin for links/logo in emails. Mirrors the invitation mailer so
// idea-confirmation mails resolve to the same deployed host.
function appBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://innovation-to-impact.vercel.app';
  return base.replace(/\/$/, '');
}

function logoUrl(): string {
  return `${appBaseUrl()}/brand/Competition-Innovation-Program-logo-white.png`;
}

function ideaDetailUrl(ideaId: string, locale: Locale): string {
  return `${appBaseUrl()}/${locale}/ideas/${ideaId}`;
}

/**
 * Build the branded "idea received" confirmation email (branded Round 11
 * template via renderMailHtml). Single CTA linking to the idea detail page.
 */
function buildSubmissionEmail(opts: {
  locale: Locale;
  greetingName: string;
  ideaTitle: string;
  ideaCode: string;
  ideaUrl: string;
  teamMember?: boolean;
}): { subject: string; html: string; text: string } {
  const ar = opts.locale === 'ar';
  const subject = ar ? 'تم استلام فكرتك' : 'Your idea has been received';

  const body = opts.teamMember
    ? ar
      ? `تمت إضافتك كعضو في فريق الفكرة "${opts.ideaTitle}". تم استلام الفكرة، سيتم إشعارك بالتحديثات.`
      : `You've been added as a team member on the idea "${opts.ideaTitle}". The idea has been received. You will be notified with updates.`
    : ar
      ? 'تم استلام فكرتك، سيتم إشعارك بالتحديثات.'
      : 'Your idea has been received. You will be notified with updates.';

  const metaItems = ar
    ? [
        { label: 'عنوان الفكرة', value: opts.ideaTitle },
        { label: 'رقم الفكرة', value: opts.ideaCode },
      ]
    : [
        { label: 'Idea title', value: opts.ideaTitle },
        { label: 'Idea code', value: opts.ideaCode },
      ];

  const html = renderMailHtml({
    subject,
    body,
    locale: opts.locale,
    logoUrl: logoUrl(),
    greetingName: opts.greetingName,
    metaItems,
    acceptUrl: opts.ideaUrl,
    acceptLabel: ar ? 'متابعة الفكرة' : 'Follow your idea',
    // Single CTA — no reject/second button on a confirmation mail.
    rejectUrl: undefined,
    extraInfoTitle: ar ? 'ما التالي؟' : "What's next?",
    extraInfoBody: ar
      ? 'سيتم إشعارك عبر البريد الإلكتروني وداخل المنصة فور مراجعة فكرتك من قبل المشرف.'
      : "You'll be notified by email and in-app as soon as a supervisor reviews your idea.",
  });

  return { subject, html, text: body };
}

/**
 * Full notification fan-out fired right after a successful idea insert.
 *
 * 1. Submitter ALWAYS gets an in-app confirmation + a branded confirmation
 *    email (regardless of any other roles they hold).
 * 2. Team members (from ideas.team_members) each receive the branded email.
 *    Delivery goes through sendMail, so the Round 14 test-redirect helper
 *    reroutes any "rayan" recipient automatically.
 * 3. Supervisors get the "new idea for review" fan-out — but the submitter is
 *    EXCLUDED so a multi-role user (e.g. innovator + supervisor) never receives
 *    a review notification for their own idea.
 *
 * Best-effort throughout: every channel is wrapped so a notification/email
 * hiccup can never block or fail the submitter's success flow.
 */
export async function notifyOnIdeaSubmission(ideaId: string): Promise<void> {
  if (!ideaId) return;
  try {
    // Prefer the service-role client for cross-user reads/writes (supervisor
    // rows, recipient emails). Fall back to the RLS-scoped session client.
    const supabase: Client | null = createAdminClient() ?? (await createClient());
    if (!supabase) return;

    const { data } = await supabase
      .from('ideas')
      .select('id, code, title_ar, title_en, team_name, team_members, submitter_id')
      .eq('id', ideaId)
      .maybeSingle();
    const idea = data as IdeaRow | null;
    if (!idea) return;

    const ideaCode = idea.code ?? ideaId;
    const submitterId = idea.submitter_id ?? null;

    // --- Submitter: locale + contact -----------------------------------------
    let submitterLocale: Locale = 'ar';
    let submitterName = '';
    let submitterEmail: string | null = null;
    if (submitterId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email, language_preference')
        .eq('id', submitterId)
        .maybeSingle();
      const p = profile as {
        full_name?: string | null;
        email?: string | null;
        language_preference?: string | null;
      } | null;
      submitterLocale = p?.language_preference === 'en' ? 'en' : 'ar';
      submitterName = (p?.full_name ?? '').trim();
      submitterEmail = p?.email ?? null;
    }

    const ideaTitle =
      (submitterLocale === 'ar'
        ? idea.title_ar || idea.title_en
        : idea.title_en || idea.title_ar) || ideaCode;

    // --- 1. Submitter in-app confirmation (Item 1) ---------------------------
    if (submitterId) {
      await createNotification(
        submitterId,
        'idea_submitted_confirmation',
        { ideaId, ideaCode, ideaTitle },
        { client: supabase, link: `/ideas/${ideaId}` }
      );
    }

    // --- 2. Submitter branded confirmation email (Item 1) --------------------
    if (submitterEmail) {
      try {
        const mail = buildSubmissionEmail({
          locale: submitterLocale,
          greetingName: submitterName || submitterEmail,
          ideaTitle,
          ideaCode,
          ideaUrl: ideaDetailUrl(ideaId, submitterLocale),
        });
        await sendMail({ to: submitterEmail, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifyOnIdeaSubmission] submitter email failed:', err);
      }
    }

    // --- 3. Team-member emails (Item 1) --------------------------------------
    // team_members is a JSONB array of { name, email }. Program default locale
    // is Arabic; team members have no per-user preference here.
    const members = Array.isArray(idea.team_members) ? idea.team_members : [];
    for (const member of members) {
      const email = (member?.email ?? '').trim();
      if (!email) continue;
      try {
        const mail = buildSubmissionEmail({
          locale: 'ar',
          greetingName: (member?.name ?? '').trim() || email,
          ideaTitle,
          ideaCode,
          ideaUrl: ideaDetailUrl(ideaId, 'ar'),
          teamMember: true,
        });
        await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifyOnIdeaSubmission] team-member email failed:', err);
      }
    }

    // --- 4. Supervisor fan-out, EXCLUDING the submitter (Item 2) -------------
    const supervisorIds = (await getSupervisorIds(supabase)).filter(
      (id) => id && id !== submitterId
    );
    if (supervisorIds.length > 0) {
      await fanOut(
        supervisorIds,
        'idea_submitted',
        { ideaId, ideaCode },
        { client: supabase, link: '/supervisor' }
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifyOnIdeaSubmission] failed:', err);
  }
}

/**
 * Backwards-compatible alias. The submit form imports this name; it now runs
 * the full submission fan-out (submitter confirmation + team emails +
 * supervisor notifications) rather than supervisors only.
 */
export async function notifySupervisorsOfNewIdea(ideaId: string): Promise<void> {
  await notifyOnIdeaSubmission(ideaId);
}
