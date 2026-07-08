import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationResponder } from '@/components/invitation-responder';

// src/app/[locale]/invitations/[token]/page.tsx
// Public landing page for an invited user.
// - Anyone with the token can view / accept / decline.
// - After accept: if a Supabase user already exists → shown a sign-in link;
//   if not → shown a "create account" link (deep-linked to the register page).

export const dynamic = 'force-dynamic';

async function loadInvitation(token: string) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .schema('innovation')
    .from('invitations')
    .select(
      'id, token, role, target_email, target_name, status, deadline_at, responded_at, response_note, sent_at'
    )
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;

  // Auto-mark viewed
  if (data.status === 'sent') {
    await admin
      .schema('innovation')
      .from('invitations')
      .update({ status: 'viewed' })
      .eq('id', data.id);
    data.status = 'viewed';
  }

  // Role display names
  const { data: roleInfo } = await admin
    .schema('innovation')
    .from('roles')
    .select('code, name_ar, name_en')
    .eq('code', data.role)
    .maybeSingle();

  // Check user existence (does an auth user with this email exist?)
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 500 });
  const existingUser =
    (authList?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === (data.target_email ?? '').toLowerCase()
    ) ?? null;

  // Program name from admin_settings
  const { data: settings } = await admin
    .schema('innovation')
    .from('admin_settings')
    .select('key, value')
    .eq('key', 'invitation_defaults')
    .maybeSingle();
  const defaults = (settings?.value as any) ?? {};

  return {
    invitation: data,
    role: roleInfo,
    userExists: !!existingUser,
    programAr: defaults.program_name_ar ?? 'برنامج ابتكر لمنافس',
    programEn: defaults.program_name_en ?? 'Innovation-to-Impact Program',
  };
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const payload = await loadInvitation(token);
  if (!payload) notFound();

  const { invitation, role, userExists, programAr, programEn } = payload;
  const roleName = isAr ? role?.name_ar ?? invitation.role : role?.name_en ?? invitation.role;
  const programName = isAr ? programAr : programEn;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-3xl bg-white p-8 shadow-xl md:p-12">
          <div className="mb-6 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 0v10a2 2 0 002 2h14a2 2 0 002-2V8m-18 0V6a2 2 0 012-2h14a2 2 0 012 2v2"
                />
              </svg>
            </div>
            <div className="mt-3 text-xs uppercase tracking-wider text-slate-500">{programName}</div>
          </div>

          <h1 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">
            {isAr ? `دعوة للانضمام بصفة ${roleName}` : `Invitation to join as ${roleName}`}
          </h1>

          <div className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">
                  {isAr ? 'المدعو' : 'Invitee'}
                </div>
                <div className="mt-0.5 font-medium">
                  {invitation.target_name ?? invitation.target_email}
                </div>
                {invitation.target_name && (
                  <div className="text-xs text-slate-500">{invitation.target_email}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {isAr ? 'الدور' : 'Role'}
                </div>
                <div className="mt-0.5 font-medium">{roleName}</div>
              </div>
              {invitation.deadline_at && (
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">
                    {isAr ? 'موعد الرد' : 'Respond by'}
                  </div>
                  <div className="mt-0.5 font-medium">
                    {new Date(invitation.deadline_at).toLocaleDateString(
                      isAr ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US',
                      { year: 'numeric', month: 'long', day: 'numeric' }
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <InvitationResponder
            token={invitation.token}
            initialStatus={invitation.status}
            responseNote={invitation.response_note}
            userExists={userExists}
            locale={isAr ? 'ar' : 'en'}
            roleName={roleName as string}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          {isAr
            ? 'إذا لم تكن أنت المقصود بهذه الرسالة، يرجى تجاهلها.'
            : 'If you were not the intended recipient, please ignore this message.'}
        </p>
      </div>
    </div>
  );
}
