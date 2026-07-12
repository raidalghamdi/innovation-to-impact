'use client';

// src/components/exports/EmailExportModal.tsx
// Dialog opened by ExportBar's "Send by Email" action. Picks a format, resolves
// the recipient under the same policy the server enforces (self-only for
// sensitive screens; self or any @gac.gov.sa address otherwise), and POSTs to
// /api/exports/send-email. The server is the source of truth — this only
// mirrors the rules for immediate feedback.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ExportFormat } from '@/components/exports/ExportBar';

const GAC_EMAIL_RE = /^[^@\s]+@gac\.gov\.sa$/i;

type Props = {
  screenId: string;
  sensitive?: boolean;
  filters?: Record<string, string | number | undefined>;
  selfEmail?: string;
  onClose: () => void;
};

type Status = 'idle' | 'sending' | 'sent' | 'failed';

export function EmailExportModal({ screenId, sensitive = false, filters, selfEmail, onClose }: Props) {
  const t = useTranslations('exports.email');

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [useOther, setUseOther] = useState(false);
  const [otherEmail, setOtherEmail] = useState('');
  const [subject, setSubject] = useState(t('subjectPrefix'));
  const [messageBody, setMessageBody] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const selfLabel = selfEmail ? `${t('recipientSelf')} (${selfEmail})` : t('recipientSelf');
  const otherInvalid = useOther && otherEmail.trim() !== '' && !GAC_EMAIL_RE.test(otherEmail.trim());
  const busy = status === 'sending';

  async function send() {
    setError('');
    // Sensitive screens ignore any "other" choice — always self.
    let recipient = 'self';
    if (!sensitive && useOther) {
      const value = otherEmail.trim();
      if (!GAC_EMAIL_RE.test(value)) {
        setError(t('invalidGac', { domain: '@gac.gov.sa' }));
        return;
      }
      recipient = value;
    }

    setStatus('sending');
    try {
      const res = await fetch('/api/exports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId,
          format,
          recipient,
          filters: filters ?? {},
          subject: subject.trim() || undefined,
          body: messageBody.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.reason ? t('invalidGac', { domain: '@gac.gov.sa' }) : t('failed'));
        setStatus('failed');
        return;
      }
      setStatus('sent');
    } catch {
      setError(t('failed'));
      setStatus('failed');
    }
  }

  const formats: ExportFormat[] = ['pdf', 'pptx', 'xlsx'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{t('title')}</h3>
          <button
            onClick={() => !busy && onClose()}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {status === 'sent' ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm text-slate-700">{t('sent')}</p>
            <Button variant="outline" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Format */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">{t('format')}</div>
              <div className="flex gap-4">
                {formats.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="export-format"
                      value={f}
                      checked={format === f}
                      onChange={() => setFormat(f)}
                    />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              {sensitive ? (
                <div>
                  <Label>{t('recipientSelf')}</Label>
                  <Input dir="ltr" value={selfEmail ?? ''} readOnly disabled />
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="export-recipient"
                        checked={!useOther}
                        onChange={() => setUseOther(false)}
                      />
                      {selfLabel}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="export-recipient"
                        checked={useOther}
                        onChange={() => setUseOther(true)}
                      />
                      {t('recipientOther')}
                    </label>
                  </div>
                  {useOther && (
                    <div>
                      <Input
                        dir="ltr"
                        type="email"
                        placeholder="name@gac.gov.sa"
                        value={otherEmail}
                        onChange={(e) => setOtherEmail(e.target.value)}
                      />
                      {otherInvalid && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                          <AlertTriangle className="h-3 w-3" />
                          {t('invalidGac', { domain: '@gac.gov.sa' })}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Optional subject / body override */}
            <div>
              <Label htmlFor="export-subject">{t('subjectLabel')}</Label>
              <Input id="export-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="export-body">{t('bodyLabel')}</Label>
              <Textarea
                id="export-body"
                rows={3}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </div>

            {error && (
              <p className="flex items-center gap-1 text-sm text-rose-600">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => !busy && onClose()} disabled={busy}>
                {t('close')}
              </Button>
              <Button onClick={send} disabled={busy || otherInvalid} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? t('sending') : t('send')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
