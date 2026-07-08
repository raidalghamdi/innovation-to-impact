import { CheckCircle2, AlertTriangle } from 'lucide-react';

// S3-09 — read-only health card for transactional email (Resend).
// `configured` is computed server-side from `process.env.RESEND_API_KEY`.
// When missing, transactional email (invites, notifications) is disabled and
// admins get a clear warning. This card is informational, not editable.
export function ResendStatusCard({
  configured,
  locale,
}: {
  configured: boolean;
  locale: string;
}) {
  const isAr = locale === 'ar';

  if (configured) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isAr ? 'البريد المعاملاتي مُفعّل' : 'Transactional email enabled'}
          </p>
          <p className="mt-0.5 text-xs">
            {isAr
              ? 'مفتاح RESEND_API_KEY مُعيَّن — يتم إرسال الدعوات والتنبيهات عبر البريد.'
              : 'RESEND_API_KEY is set — invites and alerts are delivered by email.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {isAr
            ? 'البريد المعاملاتي معطّل — لم يتم تعيين RESEND_API_KEY'
            : 'Transactional email disabled — RESEND_API_KEY not set'}
        </p>
        <p className="mt-0.5 text-xs">
          {isAr
            ? 'لن يتم إرسال رسائل الدعوة والتنبيهات حتى يتم تعيين المفتاح في متغيرات البيئة.'
            : 'Invitation and alert emails will not be sent until the key is set in environment variables.'}
        </p>
      </div>
    </div>
  );
}
