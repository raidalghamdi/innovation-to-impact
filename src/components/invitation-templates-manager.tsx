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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Template = {
  id: string;
  code: string;
  kind: 'invite' | 'accept' | 'reject' | 'reminder';
  role: string;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  is_active: boolean;
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

const KINDS: { key: Template['kind']; ar: string; en: string; icon: any }[] = [
  { key: 'invite', ar: 'دعوة', en: 'Invite', icon: Mail },
  { key: 'accept', ar: 'قبول', en: 'Accept', icon: CheckCircle2 },
  { key: 'reject', ar: 'رفض', en: 'Reject', icon: XCircle },
  { key: 'reminder', ar: 'تذكير', en: 'Reminder', icon: Bell },
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

  // Reset editor when template selection changes
  const switchTo = (kind: Template['kind'], role: string) => {
    setActiveKind(kind);
    setActiveRole(role);
    const next = templates.find((t) => t.kind === kind && t.role === role);
    setSubjectAr(next?.subject_ar ?? '');
    setSubjectEn(next?.subject_en ?? '');
    setBodyAr(next?.body_ar ?? '');
    setBodyEn(next?.body_en ?? '');
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
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {currentTpl.code}
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
    </div>
  );
}
