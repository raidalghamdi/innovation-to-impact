'use client';

// src/components/invitation-compose-form.tsx
// Flow B — compose an invitation on the Roles & Invitations (invitation-settings)
// screen. A template picker sits ABOVE the subject/body inputs: choosing a
// template pre-fills them (still editable), then the message is sent to the
// entered recipients via the template-based send endpoint.

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Template = {
  id: string;
  code: string;
  kind: string;
  role: string;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  is_active: boolean;
  is_broadcast?: boolean;
};

type Role = { code: string; name_ar: string | null; name_en: string | null };

type Props = {
  templates: Template[];
  roles: Role[];
  locale: 'ar' | 'en';
};

const KINDS = ['invite', 'accept', 'reject', 'reminder', 'open', 'open_options'] as const;

export function InvitationComposeForm({ templates, roles, locale }: Props) {
  const isAr = locale === 'ar';
  const t = useTranslations('invitations.picker');

  const [role, setRole] = useState<string>(roles[0]?.code ?? 'innovator');
  const [kind, setKind] = useState<string>('invite');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [subjectAr, setSubjectAr] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (k: 'ok' | 'err', msg: string) => {
    setToast({ kind: k, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Templates for the selected role + kind, plus all broadcast templates.
  const options = useMemo(() => {
    const matches = templates.filter(
      (tpl) => tpl.is_active && tpl.role === role && tpl.kind === kind
    );
    const broadcasts = templates.filter((tpl) => tpl.is_active && tpl.is_broadcast);
    const seen = new Set<string>();
    const merged: Template[] = [];
    for (const tpl of [...matches, ...broadcasts]) {
      if (seen.has(tpl.id)) continue;
      seen.add(tpl.id);
      merged.push(tpl);
    }
    return merged;
  }, [templates, role, kind]);

  const applyTemplate = (code: string) => {
    setSelectedCode(code);
    const tpl = templates.find((x) => x.code === code);
    if (!tpl) return;
    setSubjectAr(tpl.subject_ar ?? '');
    setSubjectEn(tpl.subject_en ?? '');
    setBodyAr(tpl.body_ar ?? '');
    setBodyEn(tpl.body_en ?? '');
  };

  const clearTemplate = () => {
    setSelectedCode('');
    setSubjectAr('');
    setSubjectEn('');
    setBodyAr('');
    setBodyEn('');
  };

  const parseRecipients = (raw: string): { email: string; name?: string }[] => {
    const seen = new Set<string>();
    return raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const m = entry.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
        const email = (m ? m[2] : entry).trim().toLowerCase();
        return { email, name: m ? m[1].trim() : undefined };
      })
      .filter((r) => {
        if (!r.email || seen.has(r.email)) return false;
        seen.add(r.email);
        return true;
      });
  };

  const send = async () => {
    if (!selectedCode) {
      showToast('err', t('noTemplate'));
      return;
    }
    const recipients = parseRecipients(recipientsText);
    if (recipients.length === 0) {
      showToast('err', t('noRecipients'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_code: selectedCode,
          recipients,
          locale,
          subject: isAr ? subjectAr : subjectEn,
          body: isAr ? bodyAr : bodyEn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'send-failed');
      showToast('ok', t('sentSuccess', { sent: data.sent ?? 0, queued: data.queued ?? 0 }));
      setRecipientsText('');
    } catch (e: any) {
      showToast('err', e?.message || t('sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (r: Role) => (isAr ? r.name_ar ?? r.code : r.name_en ?? r.code);
  const kindLabel = (k: string) => {
    const map: Record<string, string> = {
      invite: t('kindInvite'),
      accept: t('kindAccept'),
      reject: t('kindReject'),
      reminder: t('kindReminder'),
      open: t('kindOpen'),
      open_options: t('kindOpenOptions'),
    };
    return map[k] ?? k;
  };
  const tplLabel = (tpl: Template) =>
    (isAr ? tpl.subject_ar : tpl.subject_en) || tpl.code;

  return (
    <Card className="mt-6">
      {toast && (
        <div
          className={`fixed top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            isAr ? 'left-4' : 'right-4'
          } ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
          role="status"
        >
          {toast.msg}
        </div>
      )}
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('compose')}</h2>
          <p className="text-xs text-slate-500">{t('composeDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="c-role">{t('role')}</Label>
            <select
              id="c-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setSelectedCode('');
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="c-kind">{t('kind')}</Label>
            <select
              id="c-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setSelectedCode('');
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template picker — sits ABOVE the subject/body inputs */}
        <div>
          <Label htmlFor="c-template">{t('template')}</Label>
          <div className="mt-1 flex items-center gap-2">
            <select
              id="c-template"
              value={selectedCode}
              onChange={(e) => applyTemplate(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t('pickTemplate')}</option>
              {options.length === 0 ? (
                <option value="" disabled>
                  {t('noTemplatesForRole')}
                </option>
              ) : (
                options.map((tpl) => (
                  <option key={tpl.id} value={tpl.code}>
                    {tplLabel(tpl)}
                    {tpl.is_broadcast ? ` — ${t('broadcastChip')}` : ''}
                  </option>
                ))
              )}
            </select>
            {selectedCode && (
              <button
                type="button"
                onClick={clearTemplate}
                className="flex flex-none items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
                {t('clearTemplate')}
              </button>
            )}
          </div>
          {selectedCode &&
            options.find((o) => o.code === selectedCode)?.is_broadcast && (
              <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {t('broadcastChip')}
              </span>
            )}
        </div>

        {/* Manual subject/body inputs (pre-filled from template, editable) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="c-sar">{t('subjectAr')}</Label>
            <Input id="c-sar" dir="rtl" value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-sen">{t('subjectEn')}</Label>
            <Input id="c-sen" dir="ltr" value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="c-bar">{t('bodyAr')}</Label>
          <Textarea id="c-bar" dir="rtl" rows={5} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-ben">{t('bodyEn')}</Label>
          <Textarea id="c-ben" dir="ltr" rows={5} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="c-recipients">{t('recipientsLabel')}</Label>
          <Textarea
            id="c-recipients"
            dir="ltr"
            rows={4}
            placeholder={t('recipientsPlaceholder')}
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={send} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? t('sending') : t('send')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
