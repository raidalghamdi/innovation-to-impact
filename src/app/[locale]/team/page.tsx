import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { pickFromRow } from '@/lib/i18n-content';
import { Users, Lightbulb } from 'lucide-react';
import {
  createTeam,
  inviteMember,
  revokeInvitation,
  removeMember,
  leaveTeam,
} from './actions';

// <form action={...}> requires a void-returning action; our server actions
// return ActionResult (used by client components elsewhere), so these thin
// wrappers adapt them for plain uncontrolled forms. Errors still surface via
// server-side console logging inside each action.
async function createTeamForm(formData: FormData): Promise<void> {
  'use server';
  await createTeam(formData);
}
async function inviteMemberForm(teamId: string, formData: FormData): Promise<void> {
  'use server';
  await inviteMember(teamId, formData);
}
async function revokeInvitationForm(invitationId: string): Promise<void> {
  'use server';
  await revokeInvitation(invitationId);
}
async function removeMemberForm(teamId: string, userId: string): Promise<void> {
  'use server';
  await removeMember(teamId, userId);
}
async function leaveTeamForm(teamId: string): Promise<void> {
  'use server';
  await leaveTeam(teamId);
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('team');
  const user = await getCurrentUser();
  const supabase = await createClient();

  let team: any = null;
  let members: any[] = [];
  let invitations: any[] = [];
  let teamIdea: any = null;
  let isLeader = false;

  if (supabase && user) {
    // Find team via membership (covers both leader and regular members).
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role, teams(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership?.team_id) {
      team = (membership as any).teams ?? null;
      isLeader = (membership as any).role === 'leader';

      const [{ data: memberRows }, { data: inviteRows }, { data: ideaRows }] = await Promise.all([
        supabase.from('team_members').select('*').eq('team_id', membership.team_id),
        supabase
          .from('team_invitations')
          .select('*')
          .eq('team_id', membership.team_id)
          .eq('status', 'pending'),
        supabase.from('ideas').select('id, title_ar, title_en, code').eq('team_id', membership.team_id).limit(1),
      ]);
      members = memberRows ?? [];
      invitations = inviteRows ?? [];
      teamIdea = ideaRows?.[0] ?? null;
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('title')} />

      {!team && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-brand-teal">{t('createTitle')}</h2>
            <form action={createTeamForm} className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="name_ar">
                  {t('nameArLabel')}
                </label>
                <input
                  id="name_ar"
                  name="name_ar"
                  required
                  dir="rtl"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="name_en">
                  {t('nameEnLabel')}
                </label>
                <input
                  id="name_en"
                  name="name_en"
                  dir="ltr"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark"
              >
                {t('createButton')}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {team && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-brand-teal">
                  {pickFromRow(team, 'name', locale)}
                </h2>
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-brand-teal">{t('membersTitle')}</h3>
              <ul className="mt-3 space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="font-medium">
                      {m.user_id === user?.id ? user?.email : m.user_id}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-xs font-medium text-brand-teal">
                        {m.role === 'leader' ? t('leaderBadge') : t('memberBadge')}
                      </span>
                      {isLeader && m.role !== 'leader' && (
                        <form action={removeMemberForm.bind(null, team.id, m.user_id)}>
                          <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                            {t('remove')}
                          </button>
                        </form>
                      )}
                      {!isLeader && m.user_id === user?.id && (
                        <form action={leaveTeamForm.bind(null, team.id)}>
                          <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                            {t('leave')}
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Pending invitations */}
          {isLeader && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-brand-teal">
                  {t('pendingInvitationsTitle')}
                </h3>
                <ul className="mt-3 space-y-2">
                  {invitations.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                    >
                      <span dir="ltr">{inv.invited_email}</span>
                      <form action={revokeInvitationForm.bind(null, inv.id)}>
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          {t('revoke')}
                        </button>
                      </form>
                    </li>
                  ))}
                  {invitations.length === 0 && (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </ul>

                <h3 className="mt-6 text-base font-semibold text-brand-teal">{t('inviteTitle')}</h3>
                <form action={inviteMemberForm.bind(null, team.id)} className="mt-3 flex gap-2">
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder={t('inviteEmailLabel')}
                    dir="ltr"
                    className="flex h-10 flex-1 rounded-md border border-input bg-white px-3 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark"
                  >
                    {t('inviteButton')}
                  </button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Team idea */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-brand-teal">{t('teamIdeaTitle')}</h3>
              {teamIdea ? (
                <Link
                  href={`/ideas/${teamIdea.id}` as any}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-border p-3 text-sm hover:border-brand-teal/40"
                >
                  <Lightbulb className="h-4 w-4 text-brand-teal" />
                  {pickFromRow(teamIdea, 'title', locale) || teamIdea.code}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('noTeamIdea')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
