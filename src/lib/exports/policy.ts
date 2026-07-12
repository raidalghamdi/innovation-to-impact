// Server-side recipient policy for emailed exports. Two rules:
//   1. Sensitive screens (user directories, audit logs) may only be emailed to
//      the requester's own address — never to a third party, even an internal
//      one. This keeps PII/audit trails from being fanned out by a supervisor.
//   2. Everything else may go to the requester OR any @gac.gov.sa address, but
//      never to an external domain.
// The client mirrors these checks for UX, but this module is the source of
// truth: the send-email route calls assertRecipientAllowed before generating
// or dispatching anything.

export const SENSITIVE_SCREENS = [
  'admin.users',
  'admin.audit-logs',
  'admin.auditLogs',
  'supervisor.users',
  'supervisor.audit-logs',
  'supervisor.auditLogs',
] as const;

// Internal-domain gate. Same shape the EmailExportModal validates against so
// the two never drift.
export const GAC_EMAIL_RE = /^[^@\s]+@gac\.gov\.sa$/i;

export type RecipientDenialReason = 'sensitive_self_only' | 'external_not_allowed';

// Thrown when a recipient is not permitted. The route maps this to a 403 and
// surfaces `reason` so the client can show the right message.
export class RecipientNotAllowedError extends Error {
  readonly reason: RecipientDenialReason;
  constructor(reason: RecipientDenialReason) {
    super(reason);
    this.name = 'RecipientNotAllowedError';
    this.reason = reason;
  }
}

export function isSensitiveScreen(screenId: string): boolean {
  return (SENSITIVE_SCREENS as readonly string[]).includes(screenId);
}

// Throws RecipientNotAllowedError if `recipient` may not receive an export of
// `screenId` requested by `senderEmail`. A normalized (trimmed, lowercased)
// comparison is used throughout.
export function assertRecipientAllowed(input: {
  screenId: string;
  senderEmail: string | null | undefined;
  recipient: string;
}): void {
  const self = (input.senderEmail ?? '').trim().toLowerCase();
  const recipient = input.recipient.trim().toLowerCase();

  if (isSensitiveScreen(input.screenId)) {
    if (!recipient || recipient !== self) {
      throw new RecipientNotAllowedError('sensitive_self_only');
    }
    return;
  }

  if (recipient && (recipient === self || GAC_EMAIL_RE.test(recipient))) {
    return;
  }
  throw new RecipientNotAllowedError('external_not_allowed');
}
