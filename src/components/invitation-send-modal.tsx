'use client';

// src/components/invitation-send-modal.tsx
// "Send now" modal for the Invitation Templates screen. Sends a template to
// recipients gathered from one of four sources: a single email, a pasted list,
// an uploaded spreadsheet, or all users of a role / everyone (broadcast).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Mail,
  Users,
  FileSpreadsheet,
  UserRound,
  Globe,
  Loader2,
  Send,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type TemplateOption = { title: string; url?: string };

export type SendTemplate = {
  id: string;
  code: string;
  kind: string;
  role: string;
  subject_ar: string;
  subject_en: string;
  is_broadcast?: boolean;
  template_options?: TemplateOption[] | null;
};

type Role = { code: string; name_ar: string | null; name_en: string | null };

type Recipient = { email: string; name?: string };

type Props = {
  template: SendTemplate;
  roles: Role[];
  locale: 'ar' | 'en';
  onClose: () => void;
  onToast: (kind: 'ok' | 'err', msg: string) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TabKey = 'single' | 'multiple' | 'excel' | 'byRole' | 'broadcast';

export function InvitationSendModal({ template, roles, locale, onClose, onToast }: Props) {
  const isAr = locale === 'ar';
  const t = useTranslations('invitations.send');

  const isBroadcast = template.is_broadcast === true;
  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'single', label: t('tabSingle'), icon: Mail },
    { key: 'multiple', label: t('tabMultiple'), icon: Users },
    { key: 'excel', label: t('tabExcel'), icon: FileSpreadsheet },
    isBroadcast
      ? { key: 'broadcast', label: t('tabBroadcast'), icon: Globe }
      : { key: 'byRole', label: t('tabByRole'), icon: UserRound },
  ];

  const [tab, setTab] = useState<TabKey>('single');
  const [busy, setBusy] = useState(false);

  // Single
  const [singleEmail, setSingleEmail] = useState('');
  const [singleName, setSingleName] = useState('');

  // Multiple
  const [multiText, setMultiText] = useState('');

  // Excel
  const [excelRows, setExcelRows] = useState<Recipient[]>([]);
  const [excelInvalid, setExcelInvalid] = useState<string[]>([]);
  const [excelName, setExcelName] = useState('');

  // By role / broadcast preview
  const [selectedRole, setSelectedRole] = useState<string>(template.role);
  const [rolePreview, setRolePreview] = useState<Recipient[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Variable overrides (open_options templates)
  const optionTitles =
    template.kind === 'open_options' && Array.isArray(template.template_options)
      ? template.template_options.map((o) => o.title).filter(Boolean)
      : [];
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const parseList = (raw: string): { valid: Recipient[]; invalid: string[] } => {
    const parts = raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const valid: Recipient[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    for (const p of parts) {
      const m = p.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
      const email = (m ? m[2] : p).trim().toLowerCase();
      const name = m ? m[1].trim() : undefined;
      if (!EMAIL_RE.test(email)) {
        invalid.push(p);
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);
      valid.push({ email, name });
    }
    return { valid, invalid };
  };

  const multiParsed = parseList(multiText);

  const handleExcel = async (file: File) => {
    setExcelName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
      const valid: Recipient[] = [];
      const invalid: string[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        const email = String(row[0] ?? '').trim().toLowerCase();
        if (!email || email === 'email') continue; // skip header
        const name = row[1] != null ? String(row[1]).trim() : undefined;
        if (!EMAIL_RE.test(email)) {
          invalid.push(email);
          continue;
        }
        if (seen.has(email)) continue;
        seen.add(email);
        valid.push({ email, name });
      }
      setExcelRows(valid);
      setExcelInvalid(invalid);
    } catch {
      onToast('err', t('couldNotReadFile'));
      setExcelRows([]);
      setExcelInvalid([]);
    }
  };

  const loadPreview = async (role: string | null) => {
    setLoadingPreview(true);
    try {
      const qs = role ? `role=${encodeURIComponent(role)}` : 'broadcast=1';
      const res = await fetch(`/api/admin/invitations/send?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setRolePreview(data.recipients ?? []);
    } catch {
      setRolePreview([]);
      onToast('err', t('couldNotFetchUsers'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const overridePayload = () =>
    optionTitles.length > 0 && Object.keys(overrides).length > 0 ? overrides : undefined;

  const send = async () => {
    let payload: Record<string, unknown> = { template_code: template.code, locale };

    if (tab === 'single') {
      if (!EMAIL_RE.test(singleEmail.trim().toLowerCase())) {
        onToast('err', t('enterValidEmail'));
        return;
      }
      payload.recipients = [
        {
          email: singleEmail.trim().toLowerCase(),
          name: singleName.trim() || undefined,
          variable_overrides: overridePayload(),
        },
      ];
    } else if (tab === 'multiple') {
      if (multiParsed.valid.length === 0) {
        onToast('err', t('atLeastOneEmail'));
        return;
      }
      payload.recipients = multiParsed.valid.map((r) => ({
        ...r,
        variable_overrides: overridePayload(),
      }));
    } else if (tab === 'excel') {
      if (excelRows.length === 0) {
        onToast('err', t('noValidRows'));
        return;
      }
      payload.recipients = excelRows.map((r) => ({
        ...r,
        variable_overrides: overridePayload(),
      }));
    } else if (tab === 'byRole') {
      payload.send_to_all_role = selectedRole;
    } else if (tab === 'broadcast') {
      payload.broadcast = true;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'send-failed');
      onToast('ok', t('sentSuccess', { sent: data.sent ?? 0, queued: data.queued ?? 0 }));
      onClose();
    } catch (e: any) {
      onToast('err', e?.message || t('sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (r: Role) => (isAr ? r.name_ar ?? r.code : r.name_en ?? r.code);
  const subject = isAr ? template.subject_ar : template.subject_en;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {t('sendModalTitle')}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-mono">{template.code}</span>
              {subject ? ` · ${subject}` : ''}
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tb.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {tab === 'single' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="s-email">{t('emailLabel')}</Label>
                <Input
                  id="s-email"
                  type="email"
                  dir="ltr"
                  placeholder={t('emailPlaceholder')}
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="s-name">{t('nameOptional')}</Label>
                <Input id="s-name" value={singleName} onChange={(e) => setSingleName(e.target.value)} />
              </div>
            </div>
          )}

          {tab === 'multiple' && (
            <div className="space-y-2">
              <Label htmlFor="m-emails">{t('emailsLabel')}</Label>
              <Textarea
                id="m-emails"
                dir="ltr"
                rows={6}
                placeholder={t('emailsPlaceholder')}
                value={multiText}
                onChange={(e) => setMultiText(e.target.value)}
              />
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-emerald-700">
                  {t('valid')}: {multiParsed.valid.length}
                </span>
                {multiParsed.invalid.length > 0 && (
                  <span className="text-rose-600">
                    {t('invalid')}: {multiParsed.invalid.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'excel' && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 hover:border-teal-400 hover:bg-teal-50">
                <FileSpreadsheet className="h-6 w-6 text-slate-400" />
                <span>{t('uploadExcelHint')}</span>
                {excelName && <span className="text-xs text-slate-400">{excelName}</span>}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcel(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {(excelRows.length > 0 || excelInvalid.length > 0) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-emerald-700">
                    {t('validRows')}: {excelRows.length}
                  </span>
                  {excelInvalid.length > 0 && (
                    <span className="flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="h-3 w-3" />
                      {t('invalid')}: {excelInvalid.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'byRole' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="role-sel">{t('pickRole')}</Label>
                <select
                  id="role-sel"
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    setRolePreview(null);
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
              <Button type="button" variant="outline" size="sm" onClick={() => loadPreview(selectedRole)} disabled={loadingPreview}>
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : t('previewRecipients')}
              </Button>
              {rolePreview && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen((o) => !o)}
                    className="flex w-full items-center justify-between text-start"
                  >
                    <span className="font-medium text-slate-800">
                      {t('recipients')}: {rolePreview.length}
                    </span>
                    <span className="text-xs text-teal-600">{previewOpen ? t('hide') : t('show')}</span>
                  </button>
                  {previewOpen && (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                      {rolePreview.map((r) => (
                        <li key={r.email} dir="ltr">{r.email}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'broadcast' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
                <Globe className="mt-0.5 h-4 w-4 flex-none" />
                <span>{t('broadcastNote')}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => loadPreview(null)} disabled={loadingPreview}>
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : t('previewCount')}
              </Button>
              {rolePreview && (
                <p className="text-sm text-slate-700">
                  {t('totalRecipients')}: {rolePreview.length}
                </p>
              )}
            </div>
          )}

          {/* Variable overrides for open_options templates */}
          {optionTitles.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-800">
                {t('variableOverrides')}
              </div>
              {optionTitles.map((title) => (
                <div key={title}>
                  <Label htmlFor={`ov-${title}`} className="text-xs">{title}</Label>
                  <Input
                    id={`ov-${title}`}
                    value={overrides[title] ?? ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, [title]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => !busy && onClose()} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button onClick={send} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? t('sending') : t('sendButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
