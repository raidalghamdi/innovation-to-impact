'use client';

// src/components/invitation-responder.tsx
// Accept / decline UI for the public invitation page.
// After a decision, shows next-step (sign-in vs. register) based on userExists.

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  token: string;
  initialStatus: string;
  responseNote: string | null;
  userExists: boolean;
  locale: 'ar' | 'en';
  roleName: string;
};

export function InvitationResponder({
  token,
  initialStatus,
  responseNote,
  userExists,
  locale,
  roleName,
}: Props) {
  const isAr = locale === 'ar';
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(responseNote ?? '');
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (decision: 'accepted' | 'declined') => {
    setBusy(decision === 'accepted' ? 'accept' : 'decline');
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'respond-failed');
      setStatus(decision);
    } catch (e: any) {
      setError(e.message || 'error');
    } finally {
      setBusy(null);
    }
  };

  // Terminal states
  if (status === 'accepted') {
    return (
      <div className="mt-6 rounded-xl bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-lg font-semibold text-emerald-800">
          {isAr ? 'شكراً لك، تم قبول الدعوة.' : 'Invitation accepted.'}
        </h2>
        <p className="mt-2 text-sm text-emerald-700">
          {isAr
            ? `يسعدنا انضمامك بصفة ${roleName}. الخطوة التالية:`
            : `Welcome as ${roleName}. Next step:`}
        </p>
        <div className="mt-5">
          {userExists ? (
            <a
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              <LogIn className="h-4 w-4" />
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </a>
          ) : (
            <a
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" />
              {isAr ? 'إنشاء حساب' : 'Create account'}
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-emerald-600">
          {isAr
            ? 'سيصلك بريد تأكيد قريباً.'
            : 'A confirmation email is on the way.'}
        </p>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center">
        <XCircle className="mx-auto h-10 w-10 text-slate-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-700">
          {isAr ? 'تم تسجيل الاعتذار.' : 'You have declined this invitation.'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {isAr ? 'شكراً لإفادتنا.' : 'Thanks for letting us know.'}
        </p>
      </div>
    );
  }

  if (status === 'expired' || status === 'withdrawn') {
    return (
      <div className="mt-6 rounded-xl bg-amber-50 p-6 text-center text-amber-800">
        <h2 className="text-lg font-semibold">
          {isAr ? 'الدعوة لم تعد صالحة.' : 'This invitation is no longer valid.'}
        </h2>
        <p className="mt-1 text-sm">
          {isAr ? 'يرجى التواصل مع المسؤول.' : 'Please contact the program administrator.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <label className="block text-sm text-slate-700">
        {isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isAr
              ? 'يمكنك إضافة أي ملاحظات ترى ذكرها.'
              : 'Add any notes you\u2019d like to share.'
          }
          className="mt-2"
        />
      </label>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={() => respond('accepted')}
          disabled={!!busy}
          className="min-w-40 gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          {busy === 'accept' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {isAr ? 'قبول الدعوة' : 'Accept invitation'}
        </Button>
        <Button
          variant="outline"
          onClick={() => respond('declined')}
          disabled={!!busy}
          className="min-w-40 gap-2"
        >
          {busy === 'decline' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {isAr ? 'اعتذار' : 'Decline'}
        </Button>
      </div>
    </div>
  );
}
