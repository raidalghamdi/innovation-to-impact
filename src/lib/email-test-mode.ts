/**
 * Server-side helpers for the R42 email test mode. When EMAIL_TEST_MODE=true,
 * lib/mailer.ts redirects every outbound email to EMAIL_TEST_RECIPIENT; these
 * helpers let server components surface that state to admins in the UI.
 */
export function isEmailTestMode() {
  return process.env.EMAIL_TEST_MODE === 'true';
}

export function getEmailTestRecipient() {
  return process.env.EMAIL_TEST_RECIPIENT ?? '';
}
