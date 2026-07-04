import { getTranslations } from 'next-intl/server';
import { CountdownTicker } from './countdown-ticker';

// SERVER component. Reads NEXT_PUBLIC_SUBMISSION_DEADLINE and computes the
// initial time-remaining synchronously at request time. Hands the pre-computed
// initial values plus the target timestamp to <CountdownTicker>, a tiny client
// component that only handles the per-second tick.
//
// Why this is architecturally permanent:
//   1. SSR HTML always contains real digits — never em-dashes, never null.
//   2. Digits are computed at request time (page is dynamic), so CDN cache
//      can't ship stale numbers.
//   3. JS-disabled users see accurate digits within seconds of the request.
//   4. No hydration mismatch: client seeds from the same target timestamp and
//      immediately reconciles to its own wall-clock via useEffect.
//
// If the env var is missing or unparseable, renders nothing (preserves prior
// behavior). Optional `target` prop overrides the env var for previews/tests.
export async function Countdown({ target }: { target?: string }) {
  const raw = target ?? process.env.NEXT_PUBLIC_SUBMISSION_DEADLINE;
  const end = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(end)) return null;

  const t = await getTranslations('landing');
  const now = Date.now();
  const diff = Math.max(0, end - now);

  const initial = {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };

  const labels = {
    days: t('days'),
    hours: t('hours'),
    minutes: t('minutes'),
    seconds: t('seconds'),
    ended: t('countdownEnded'),
    title: t('countdownTitle'),
  };

  return <CountdownTicker endMs={end} initial={initial} labels={labels} />;
}
