import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { getUserPoints, getUserBadges, getAllBadges } from '@/lib/gamification';
import {
  Award,
  Sparkles,
  CheckCircle2,
  Rocket,
  Star,
  Lock,
  Trophy,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_idea: Sparkles,
  approved_idea: CheckCircle2,
  evaluator_5: Star,
  implemented: Rocket,
};

// Points needed per level (simple linear model for the "to next level" hint).
const POINTS_PER_LEVEL = 100;

export async function GamificationPanel({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  const t = await getTranslations('gamification');
  const isAr = locale === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const [{ points, level }, allBadges, earnedMap] = await Promise.all([
    getUserPoints(userId),
    getAllBadges(),
    getUserBadges(userId),
  ]);

  const toNext = Math.max(0, POINTS_PER_LEVEL - (points % POINTS_PER_LEVEL));
  const earnedCount = allBadges.filter((b) => earnedMap.has(b.code)).length;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-teal">{t('title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/profile/level"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
        >
          <Trophy className="h-4 w-4" />
          {t('viewLeaderboard')}
          <Chevron className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Points + level */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand-teal to-brand-teal-dark text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-brand-cyan-light">{t('points')}</p>
            <p className="mt-1 text-3xl font-bold">{points}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('level')}</p>
            <p className="mt-1 text-3xl font-bold text-brand-teal">{level}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('nextLevel', { n: toNext })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('badgesTitle')}
            </p>
            <p className="mt-1 text-3xl font-bold text-brand-gold">{earnedCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('badgesEarned', { earned: earnedCount, total: allBadges.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Badge grid */}
      {allBadges.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {allBadges.map((badge) => {
            const earnedAt = earnedMap.get(badge.code);
            const isEarned = Boolean(earnedAt);
            const Icon = BADGE_ICONS[badge.code] ?? Award;
            const name = (() => {
              const key = `badge_${badge.code}` as const;
              const localized = t(key as any);
              // If no translation, fall back to DB value.
              return localized.startsWith('badge_')
                ? isAr
                  ? badge.name_ar
                  : badge.name
                : localized;
            })();
            const desc = (() => {
              const key = `badge_${badge.code}_desc` as const;
              const localized = t(key as any);
              return localized.startsWith('badge_')
                ? (isAr ? badge.description_ar : badge.description) ?? ''
                : localized;
            })();
            return (
              <Card
                key={badge.code}
                className={cn(
                  'transition',
                  isEarned ? 'border-brand-gold/40' : 'opacity-70'
                )}
              >
                <CardContent className="flex gap-3 p-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      isEarned
                        ? 'bg-brand-gold-light text-brand-gold'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isEarned ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
                    <p className="mt-1 text-[11px] font-medium">
                      {isEarned ? (
                        <span className="text-brand-teal">
                          {t('earnedOn', { date: formatDate(earnedAt!, locale) })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('locked')}</span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
