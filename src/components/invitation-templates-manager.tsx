'use client';

// src/components/invitation-templates-manager.tsx
// UI for editing email templates (subject/body AR+EN) per role + kind,
// with per-template attachments (upload/delete via API).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Upload,
  Trash2,
  Loader2,
  FileText,
  Mail,
  CheckCircle2,
  XCircle,
  Bell,
  Globe,
  Unlock,
  ListChecks,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InvitationSendModal } from '@/components/invitation-send-modal';

// `open` / `open_options` and `is_broadcast` / `template_options` are Round-2
// additions. They require DB changes before they are fully functional (see
// commit notes): the innovation.email_templates.kind ENUM must gain the two
// new values, and columns `is_broadcast boolean` + `template_options jsonb`
// must be added. Until then the UI renders but persistence of these fields
// will error (handled gracefully with a toast).
type TemplateKind = 'invite' | 'accept' | 'reject' | 'reminder' | 'open' | 'open_options';

type TemplateOption = { title: string; url?: string };

type Template = {
  id: string;
  code: string;
  kind: TemplateKind;
  role: string;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  is_active: boolean;
  is_broadcast?: boolean;
  template_options?: TemplateOption[] | null;
};

type Attachment = {
  id: string;
  template_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type Role = { code: string; name_ar: string | null; name_en: string | null };

type Props = {
  templates: Template[];
  attachments: Attachment[];
  roles: Role[];
  locale: 'ar' | 'en';
};

const KINDS: { key: TemplateKind; ar: string; en: string; icon: any }[] = [
  { key: 'invite', ar: 'دعوة', en: 'Invite', icon: Mail },
  { key: 'accept', ar: 'قبول', en: 'Accept', icon: CheckCircle2 },
  { key: 'reject', ar: 'رفض', en: 'Reject', icon: XCircle },
  { key: 'reminder', ar: 'تذكير', en: 'Reminder', icon: Bell },
  { key: 'open', ar: 'مفتوح', en: 'Open', icon: Unlock },
  { key: 'open_options', ar: 'مفتوح الخيارات', en: 'Open Options', icon: ListChecks },
];

export function InvitationTemplatesManager({
  templates: initialTemplates,
  attachments: initialAttachments,
  roles,
  locale,
}: Props) {
  const router = useRouter();
  const isAr = locale === 'ar';

  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [activeKind, setActiveKind] = useState<Template['kind']>('invite');
  const [activeRole, setActiveRole] = useState<string>(roles[0]?.code ?? 'innovator');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [showSend, setShowSend] = useState(false);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const currentTpl = useMemo(
    () => templates.find((t) => t.kind === activeKind && t.role === activeRole),
    [templates, activeKind, activeRole]
  );
  const currentAttachments = useMemo(
    () => (currentTpl ? attachments.filter((a) => a.template_id === currentTpl.id) : []),
    [attachments, currentTpl]
  );

  const [subjectAr, setSubjectAr] = useState(currentTpl?.subject_ar ?? '');
  const [subjectEn, setSubjectEn] = useState(currentTpl?.subject_en ?? '');
  const [bodyAr, setBodyAr] = useState(currentTpl?.body_ar ?? '');
  const [bodyEn, setBodyEn] = useState(currentTpl?.body_en ?? '');
  const [isBroadcast, setIsBroadcast] = useState<boolean>(currentTpl?.is_broadcast ?? false);
  const [options, setOptions] = useState<TemplateOption[]>(currentTpl?.template_options ?? []);

  // Reset editor when template selection changes
  const switchTo = (kind: TemplateKind, role: string) => {
    setActiveKind(kind);
    setActiveRole(role);
    const next = templates.find((t) => t.kind === kind && t.role === role);
    setSubjectAr(next?.subject_ar ?? '');
    setSubjectEn(next?.subject_en ?? '');
    setBodyAr(next?.body_ar ?? '');
    setBodyEn(next?.body_en ?? '');
    setIsBroadcast(next?.is_broadcast ?? false);
    setOptions(next?.template_options ?? []);
  };

  const save = async () => {
    if (!currentTpl) return;
    setBusy('save');
    try {
      const res = await fetch('/api/admin/invitations/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentTpl.id,
          subject_ar: subjectAr,
          subject_en: subjectEn,
          body_ar: bodyAr,
          body_en: bodyEn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save-failed');
      setTemplates((prev) =>
        prev.map((t) => (t.id === data.template.id ? { ...t, ...data.template } : t))
      );
      showToast('ok', isAr ? 'تم الحفظ.' : 'Saved.');
    } catch (e: any) {
      showToast('err', e.message || 'error');
    } finally {
      setBusy(null);
    }
  };

  // Persist Round-2 metadata (broadcast flag + open-options list) separately
  // from the subject/body save, so a missing DB column can't block core edits.
  const saveMeta = async (patch: { is_broadcast?: boolean; template_options?: TemplateOption[] }) => {
    if (!currentTpl) return;
    setBusy('meta');
    try {
      const res = await fetch('/api/admin/invitations/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentTpl.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save-failed');
      setTemplates((prev) =>
        prev.map((t) => (t.id === currentTpl.id ? { ...t, ...patch } : t))
      );
      showToast('ok', isAr ? 'تم الحفظ.' : 'Saved.');
    } catch (e: any) {
      showToast(
        'err',
        isAr
          ? 'تعذّر الحفظ — قد تتطلب هذه الميزة تحديث قاعدة البيانات.'
          : 'Save failed — this feature may require a database update.'
      );
    } finally {
      setBusy(null);
    }
  };

  const toggleBroadcast = async () => {
    const next = !isBroadcast;
    setIsBroadcast(next);
    await saveMeta({ is_broadcast: next });
  };

  const addOption = () => setOptions((prev) => [...prev, { title: '', url: '' }]);
  const updateOption = (i: number, patch: Partial<TemplateOption>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const removeOption = (i: number) =>
    setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const uploadFile = async (file: File) => {
    if (!currentTpl) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('template_id', currentTpl.id);
      fd.append('file', file);
      const res = await fetch('/api/admin/invitations/attachments', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'upload-failed');
      setAttachments((prev) => [...prev, data.attachment]);
      showToast('ok', isAr ? 'رفعت المرفق.' : 'Uploaded.');
    } catch (e: any) {
      showToast('err', e.message || 'error');
    } finally {
      setBusy(null);
    }
  };

  const deleteAttachment = async (id: string) => {
    if (!confirm(isAr ? 'حذف المرفق؟' : 'Delete this attachment?')) return;
    setBusy('del-' + id);
    try {
      const res = await fetch(`/api/admin/invitations/attachments?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete-failed');
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      showToast('ok', isAr ? 'حُذف.' : 'Deleted.');
    } catch (e: any) {
      showToast('err', e.message || 'error');
    } finally {
      setBusy(null);
    }
  };

  const roleLabel = (r: Role) => (isAr ? r.name_ar ?? r.code : r.name_en ?? r.code);

  return (
    <div className="mt-6 space-y-6">
      {toast && (
        <div
          className={`fixed top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            isAr ? 'left-4' : 'right-4'
          } ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Kind tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const isActive = activeKind === k.key;
          return (
            <button
              key={k.key}
              onClick={() => switchTo(k.key, activeRole)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {isAr ? k.ar : k.en}
            </button>
          );
        })}
      </div>

      {/* Role pills */}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => {
          const isActive = activeRole === r.code;
          return (
            <button
              key={r.code}
              onClick={() => switchTo(activeKind, r.code)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {roleLabel(r)}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {currentTpl ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {currentTpl.code}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSend(true)}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {isAr ? 'أرسل الآن' : 'Send now'}
                </Button>
              </div>

              <div>
                <Label htmlFor="sar">{isAr ? 'الموضوع (عربي)' : 'Subject (AR)'}</Label>
                <Input id="sar" dir="rtl" value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sen">{isAr ? 'الموضوع (إنجليزي)' : 'Subject (EN)'}</Label>
                <Input id="sen" value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bar">{isAr ? 'النص (عربي)' : 'Body (AR)'}</Label>
                <Textarea id="bar" dir="rtl" rows={8} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ben">{isAr ? 'النص (إنجليزي)' : 'Body (EN)'}</Label>
                <Textarea id="ben" rows={8} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">
                  {isAr ? 'المتغيرات المدعومة:' : 'Supported placeholders:'}
                </div>
                <code className="mt-1 block font-mono text-[11px]">
                  {'{{name}} · {{role}} · {{link}} · {{deadline}} · {{program}}'}
                </code>
              </div>

              {/* "For everyone" broadcast toggle — marks the template as a
                  generic broadcast (not tied to a single invitee). */}
              <button
                type="button"
                onClick={toggleBroadcast}
                disabled={busy === 'meta'}
                aria-pressed={isBroadcast}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-start transition ${
                  isBroadcast
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Globe className={`h-4 w-4 ${isBroadcast ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium text-slate-800">
                    {isAr ? 'قالب للجميع' : 'For everyone'}
                  </span>
                </span>
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                    isBroadcast ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      isBroadcast ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              {/* Open-options editor — only for the `open_options` kind. Lets
                  the admin define clickable options (title + optional URL)
                  embedded in the invitation. */}
              {activeKind === 'open_options' && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      {isAr ? 'الخيارات القابلة للنقر' : 'Clickable options'}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={addOption} className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      {isAr ? 'إضافة خيار' : 'Add option'}
                    </Button>
                  </div>
                  {options.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {isAr ? 'لا توجد خيارات بعد.' : 'No options yet.'}
                    </p>
                  ) : (
                    options.map((opt, i) => (
                      <div key={i} className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder={isAr ? 'العنوان' : 'Title'}
                          value={opt.title}
                          onChange={(e) => updateOption(i, { title: e.target.value })}
                        />
                        <Input
                          placeholder={isAr ? 'الرابط (اختياري)' : 'URL (optional)'}
                          value={opt.url ?? ''}
                          onChange={(e) => updateOption(i, { url: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="rounded p-2 text-rose-600 hover:bg-rose-50"
                          aria-label={isAr ? 'حذف' : 'Remove'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === 'meta'}
                      onClick={() => saveMeta({ template_options: options })}
                      className="gap-2"
                    >
                      {busy === 'meta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isAr ? 'حفظ الخيارات' : 'Save options'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={save} disabled={busy === 'save'} className="gap-2">
                  {busy === 'save' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isAr ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attachments panel */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                {isAr ? 'المرفقات' : 'Attachments'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'تُرفق تلقائياً مع كل رسالة من هذا القالب.'
                  : 'Automatically attached to every email using this template.'}
              </p>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-teal-400 hover:bg-teal-50">
                {busy === 'upload' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isAr ? 'رفع ملف' : 'Upload file'}
                <input
                  type="file"
                  className="hidden"
                  disabled={busy === 'upload'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                    e.target.value = '';
                  }}
                />
              </label>

              <div className="space-y-2">
                {currentAttachments.length === 0 ? (
                  <div className="text-center text-xs text-slate-400">
                    {isAr ? 'لا توجد مرفقات.' : 'No attachments yet.'}
                  </div>
                ) : (
                  currentAttachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 flex-none text-slate-400" />
                        <span className="truncate text-slate-700">{a.file_name}</span>
                      </div>
                      <button
                        onClick={() => deleteAttachment(a.id)}
                        disabled={busy === 'del-' + a.id}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                        aria-label="delete"
                      >
                        {busy === 'del-' + a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {isAr ? 'لا يوجد قالب لهذا الدور.' : 'No template for this role.'}
        </div>
      )}

      {showSend && currentTpl && (
        <InvitationSendModal
          template={currentTpl}
          roles={roles}
          locale={locale}
          onClose={() => setShowSend(false)}
          onToast={showToast}
        />
      )}
    </div>
  );
}
