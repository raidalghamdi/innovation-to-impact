'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification, type NotificationType } from '@/lib/notifications';
import { renderMailHtml, sendMail } from '@/lib/mailer';

// Screening-decision fan-out (Round 17, Section D). When a supervisor approves,
// rejects, or returns an idea, the submitter + every team member receive the
// exact bilingual copy below — in-app (submitter) and as a branded CTA email
// (submitter + team). Best-effort: never throws, never blocks the decision.

type Client = SupabaseClient<any, any, any>;
type Locale = 'ar' | 'en';
type TeamMember = { name?: string | null; email?: string | null };

export type IdeaDecisionEvent = 'approved' | 'rejected' | 'returned';

type EventCopy = {
  type: NotificationType;
  path: (id: string) => string;
  ar: { title: string; body: string; cta: string };
  en: { title: string; body: string; cta: string };
};

// Exact wording per the Round 17 brief. Keep in sync with the notifications
// copy in messages/{ar,en}.json (in-app rows are resolved from those files).
const EVENT_COPY: Record<IdeaDecisionEvent, EventCopy> = {
  approved: {
    type: 'idea_approved',
    path: (id) => `ideas/${id}`,
    ar: {
      title: 'تحديث بشأن فكرتك',
      body: 'تجاوزت فكرتك الفحص الأولي، وجاري تقييمها من قِبل المُقيّم.',
      cta: 'متابعة الفكرة',
    },
    en: {
      title: 'Update on your idea',
      body: 'Your idea has passed the initial screening and is now being evaluated.',
      cta: 'Follow your idea',
    },
  },
  rejected: {
    type: 'idea_rejected',
    path: (id) => `ideas/${id}`,
    ar: {
      title: 'قرار بشأن فكرتك',
      body: 'نعتذر عن قبول الفكرة لعدم استيفاء المتطلبات.',
      cta: 'متابعة الفكرة',
    },
    en: {
      title: 'Decision on your idea',
      body: 'We are sorry — your idea was not accepted due to unmet requirements.',
      cta: 'Follow your idea',
    },
  },
  returned: {
    type: 'idea_feedback_requested',
    path: (id) => `ideas/${id}/edit`,
    ar: {
      title: 'تم إعادة الفكرة للتعديل',
      body: 'تم إعادة الفكرة. يرجى مراجعة الملاحظات واستيفاء المتطلبات.',
      cta: 'تعديل الفكرة',
    },
    en: {
      title: 'Your idea was returned for revision',
      body: 'Your idea has been returned. Please review the comments and complete the required changes.',
      cta: 'Edit your idea',
    },
  },
};

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

function absoluteUrl(locale: Locale, path: string): string {
  return `${appBaseUrl()}/${locale}/${path}`;
}

type IdeaRow = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  team_name: string | null;
  team_members: TeamMember[] | null;
  submitter_id: string | null;
};

/**
 * Notify the submitter + team members of a supervisor screening decision.
 * `reason` is the supervisor note (surfaced only in the returned-idea flow).
 */
export async function notifyIdeaDecision(
  ideaId: string,
  event: IdeaDecisionEvent
): Promise<void> {
  if (!ideaId) return;
  try {
    const supabase: Client | null = createAdminClient() ?? (await createClient());
    if (!supabase) return;

    const { data } = await supabase
      .from('ideas')
      .select('id, code, title_ar, title_en, team_name, team_members, submitter_id')
      .eq('id', ideaId)
      .maybeSingle();
    const idea = data as IdeaRow | null;
    if (!idea) return;

    const copy = EVENT_COPY[event];
    const ideaCode = idea.code ?? ideaId;
    const submitterId = idea.submitter_id ?? null;

    // Submitter locale + contact.
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

    // 1) In-app notification to the submitter (copy resolved from messages).
    if (submitterId) {
      await createNotification(
        submitterId,
        copy.type,
        { ideaId, ideaCode, ideaTitle },
        { client: supabase, link: `/${copy.path(ideaId)}` }
      );
    }

    // 2) Branded CTA email to the submitter.
    if (submitterEmail) {
      try {
        const mail = buildDecisionEmail({
          event,
          locale: submitterLocale,
          greetingName: submitterName || submitterEmail,
          ideaTitle,
          ideaCode,
          ctaUrl: absoluteUrl(submitterLocale, copy.path(ideaId)),
        });
        await sendMail({ to: submitterEmail, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifyIdeaDecision] submitter email failed:', err);
      }
    }

    // 3) Branded CTA email to each team member (Arabic — no per-user preference).
    const members = Array.isArray(idea.team_members) ? idea.team_members : [];
    for (const member of members) {
      const email = (member?.email ?? '').trim();
      if (!email) continue;
      try {
        const mail = buildDecisionEmail({
          event,
          locale: 'ar',
          greetingName: (member?.name ?? '').trim() || email,
          ideaTitle,
          ideaCode,
          ctaUrl: absoluteUrl('ar', copy.path(ideaId)),
        });
        await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifyIdeaDecision] team-member email failed:', err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifyIdeaDecision] failed:', err);
  }
}

function buildDecisionEmail(opts: {
  event: IdeaDecisionEvent;
  locale: Locale;
  greetingName: string;
  ideaTitle: string;
  ideaCode: string;
  ctaUrl: string;
}): { subject: string; html: string; text: string } {
  const c = EVENT_COPY[opts.event][opts.locale];
  const ar = opts.locale === 'ar';
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
    subject: c.title,
    body: c.body,
    locale: opts.locale,
    logoUrl: logoUrl(),
    greetingName: opts.greetingName,
    metaItems,
    acceptUrl: opts.ctaUrl,
    acceptLabel: c.cta,
    rejectUrl: undefined,
  });

  return { subject: c.title, html, text: c.body };
}
