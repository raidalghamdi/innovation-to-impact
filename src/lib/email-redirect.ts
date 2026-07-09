/**
 * TEST-ONLY email redirect.
 *
 * When EMAIL_TEST_REDIRECT=true, any outgoing email whose recipient list
 * contains an address matching EMAIL_TEST_REDIRECT_PATTERN (default "rayan",
 * case-insensitive) is rerouted to EMAIL_TEST_REDIRECT_TO. The original
 * recipient(s) are prepended to the subject as a visible banner so the tester
 * can immediately see who the mail was really addressed to.
 *
 * Handles `to` as a single address, a comma-separated string, or an array. If
 * ANY recipient matches, the whole list is replaced with the redirect target.
 */

function toRecipientArray(to: string | string[]): string[] {
  const arr = Array.isArray(to) ? to : String(to).split(',');
  return arr.map((s) => s.trim()).filter(Boolean);
}

export type RedirectResult = {
  to: string | string[];
  subject: string;
};

/**
 * Returns the (possibly redirected) recipients + subject. Preserves the input
 * `to` shape (string vs array). No-op unless EMAIL_TEST_REDIRECT=true and a
 * recipient matches the pattern.
 */
export function applyTestRedirect(to: string | string[], subject: string): RedirectResult {
  const enabled = process.env.EMAIL_TEST_REDIRECT === 'true';
  if (!enabled) return { to, subject };

  const target = process.env.EMAIL_TEST_REDIRECT_TO ?? 'raid.a.alghamdi@gmail.com';
  const pattern = (process.env.EMAIL_TEST_REDIRECT_PATTERN ?? 'rayan').toLowerCase();

  const recipients = toRecipientArray(to);
  const matched = recipients.some((r) => r.toLowerCase().includes(pattern));
  if (!matched) return { to, subject };

  const original = recipients.join(', ');
  // eslint-disable-next-line no-console
  console.log(`[email-test-redirect] Redirecting ${original} → ${target}`);
  return {
    to: Array.isArray(to) ? [target] : target,
    subject: `[TEST → ${original}] ${subject}`,
  };
}
