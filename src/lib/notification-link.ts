// Normalizes a stored notification `link` into a valid, locale-less app path.
//
// Notification rows persist locale-less paths (the i18n <Link> prepends the
// active locale). Legacy rows stored targets that 404 — chiefly idea details
// under `/my-ideas/{id}` (the real route is `/ideas/{id}`) and a non-existent
// per-idea supervisor route. This maps those to valid pages and falls back to
// the notifications inbox when the link is missing or unusable.
export function normalizeNotificationLink(link: string | null | undefined): string {
  if (!link || typeof link !== 'string') return '/notifications';
  const trimmed = link.trim();
  if (!trimmed || !trimmed.startsWith('/')) return '/notifications';

  // Legacy: idea details were mistakenly stored under /my-ideas/{id}.
  const myIdeasDetail = trimmed.match(/^\/my-ideas\/([^/?#]+)(.*)$/);
  if (myIdeasDetail) return `/ideas/${myIdeasDetail[1]}${myIdeasDetail[2] ?? ''}`;

  // Legacy: there is no per-idea supervisor route — send to the queue.
  if (/^\/supervisor\/ideas\/[^/?#]+/.test(trimmed)) return '/supervisor';

  return trimmed;
}
