import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboard, type LeaderboardRow } from '@/lib/analytics';
import { isRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/empty-state';
import { Trophy, Medal, Award, Star } from 'lucide-react';

function displayName(row: LeaderboardRow, isAr: boolean): string {
  return (isAr ? row.full_name_ar : row.full_name) || row.full_name || row.email || '—';
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('leaderboard');
  const tr = await getTranslations('roles');
  const te = await getTranslations('emptyStates');
  const isAr = locale === 'ar';

  const rows = await getLeaderboard();

  const supabase = await createClient();
  const userId = supabase ? (await supabase.auth.getUser()).data.user?.id ?? null : null;
  const myRow = userId ? rows.find((r) => r.id === userId) ?? null : null;

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const roleLabel = (role: string | null) =>
    role && isRole(role) ? tr(role) : role ?? '';

  const medalColor = ['text-brand-gold', 'text-brand-cyan', 'text-[#A84B2F]'];
  const MedalIcon = [Trophy, Medal, Award];
  // Visual ordering for podium: 2nd, 1st, 3rd.
  const podiumOrder = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i);

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={te('leaderboardTitle')}
          description={te('leaderboardBody')}
          cta={{ label: te('leaderboardCta'), href: '/ideas/new' }}
        />
      ) : (
        <>
          {/* Your rank */}
          {myRow && (
            <Card className="mb-6 border-brand-teal/40 bg-brand-teal-light/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal text-sm font-bold text-white">
                    #{myRow.rank}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-teal">{t('yourRank')}</p>
                    <p className="text-xs text-muted-foreground">{displayName(myRow, isAr)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <span className="font-semibold text-brand-teal">
                    {myRow.points} <span className="text-xs font-normal">{t('pointsUnit')}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {t('levelShort')} {myRow.level}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-brand-gold" />
                    {myRow.n_badges}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Podium */}
          {podium.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t('topThree')}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {podiumOrder.map((idx) => {
                  const row = podium[idx];
                  if (!row) return null;
                  const Icon = MedalIcon[idx];
                  const isFirst = idx === 0;
                  return (
                    <Card
                      key={row.id}
                      className={cn(
                        'text-center',
                        isFirst && 'sm:-translate-y-2 border-brand-gold/50 shadow-md',
                        row.id === userId && 'ring-2 ring-brand-teal'
                      )}
                    >
                      <CardContent className="flex flex-col items-center gap-2 p-6">
                        <Icon className={cn('h-8 w-8', medalColor[idx])} />
                        <span className="text-xs font-bold text-muted-foreground">#{row.rank}</span>
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">
                          {displayName(row, isAr)}
                          {row.id === userId && (
                            <span className="ms-1 text-xs text-brand-teal">({t('you')})</span>
                          )}
                        </p>
                        <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-[11px] font-medium text-brand-teal">
                          {roleLabel(row.role)}
                        </span>
                        <p className="mt-1 text-2xl font-bold text-brand-teal">{row.points}</p>
                        <p className="text-[11px] text-muted-foreground">{t('pointsUnit')}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {t('levelShort')} {row.level}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 text-brand-gold" />
                            {row.n_badges}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Table for ranks 4+ */}
          {rest.length > 0 && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-brand-teal-light/50">
                    <tr>
                      <th className="p-3 text-start font-semibold text-brand-teal">{t('rank')}</th>
                      <th className="p-3 text-start font-semibold text-brand-teal">{t('name')}</th>
                      <th className="p-3 text-start font-semibold text-brand-teal">{t('role')}</th>
                      <th className="p-3 text-end font-semibold text-brand-teal">{t('level')}</th>
                      <th className="p-3 text-end font-semibold text-brand-teal">{t('points')}</th>
                      <th className="p-3 text-end font-semibold text-brand-teal">{t('badges')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-t border-border',
                          row.id === userId && 'bg-brand-teal-light/40'
                        )}
                      >
                        <td className="p-3 font-mono text-muted-foreground">#{row.rank}</td>
                        <td className="p-3 font-medium text-foreground">
                          {displayName(row, isAr)}
                          {row.id === userId && (
                            <span className="ms-1 text-xs text-brand-teal">({t('you')})</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {roleLabel(row.role)}
                          </span>
                        </td>
                        <td className="p-3 text-end text-muted-foreground">{row.level}</td>
                        <td className="p-3 text-end font-semibold text-brand-teal">{row.points}</td>
                        <td className="p-3 text-end text-muted-foreground">{row.n_badges}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
