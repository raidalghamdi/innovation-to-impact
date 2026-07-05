import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { PublicShell } from '@/components/public-shell';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { acceptInvitation, declineInvitation } from '@/app/[locale]/team/actions';
import { pickFromRow } from '@/lib/i18n-content';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('invite');

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: `/login?next=/invite/${token}`, locale });
  }

  const supabase = await createClient();
  let invite: any = null;
  let team: any = null;

  if (supabase) {
    const { data } = await supabase
      .from('team_invitations')
      .select('*, teams(*)')
      .eq('token', token)
      .maybeSingle();
    invite = data;
    team = data?.teams ?? null;
  }

  if (!invite) {
    return (
      <PublicShell locale={locale}>
        <h1 className="text-xl font-bold text-brand-teal">{t('title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('expired')}</p>
      </PublicShell>
    );
  }

  let statusMessage: string | null = null;
  if (invite.status === 'revoked') statusMessage = t('revoked');
  else if (invite.status === 'accepted') statusMessage = t('accepted');
  else if (invite.status === 'declined') statusMessage = t('declined');
  else if (new Date(invite.expires_at) < new Date()) statusMessage = t('expired');

  const emailMatches = (invite.invited_email ?? '').toLowerCase() === (user?.email ?? '').toLowerCase();

  async function accept() {
    'use server';
    const res = await acceptInvitation(token);
    if (res.ok) {
      redirect({ href: '/team', locale });
    }
  }

  async function decline() {
    'use server';
    await declineInvitation(token);
  }

  return (
    <PublicShell locale={locale}>
      <h1 className="text-xl font-bold text-brand-teal">{t('title')}</h1>

      {team && (
        <p className="mt-2 text-sm text-muted-foreground">
          {pickFromRow(team, 'name', locale)}
        </p>
      )}

      {statusMessage ? (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-foreground">{statusMessage}</p>
      ) : !emailMatches ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('wrongAccount')}</p>
      ) : (
        <div className="mt-6 flex gap-3">
          <form action={accept}>
            <button
              type="submit"
              className="rounded-md bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark"
            >
              {t('accept')}
            </button>
          </form>
          <form action={decline}>
            <button
              type="submit"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              {t('decline')}
            </button>
          </form>
        </div>
      )}
    </PublicShell>
  );
}
