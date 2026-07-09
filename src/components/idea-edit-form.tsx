'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { uploadEvidence } from '@/lib/storage';
import { AlertTriangle, Lock, Save, X, Paperclip, FileText, CheckCircle2 } from 'lucide-react';

const ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10MB — mirrors lib/storage.ts.
const ATTACH_ALLOWED_EXT = /\.(pdf|jpe?g|png|docx)$/i;

type Section =
  | 'activity_id'
  | 'strategic_theme_id'
  | 'challenge'
  | 'participation_type'
  | 'team'
  | 'title'
  | 'proposed_solution'
  | 'attachments';

type TeamMemberInput = { name: string; email: string };
type Option = { id: string; name_ar: string | null; name_en: string | null };

type Props = {
  locale: string;
  ideaId: string;
  initial: {
    title_ar: string | null;
    title_en: string | null;
    proposed_solution: string | null;
    activity_id: string | null;
    strategic_theme_id: string | null;
    challenge: string;
    participation_type: 'individual' | 'team';
    team_name: string | null;
    team_members: TeamMemberInput[];
  };
  activities: Option[];
  themes: Option[];
  editableSections: Section[]; // supervisor-selected editable sections
  reason: string | null; // supervisor notes shown at top
};

/**
 * Partial-edit form for a returned idea.
 *
 * The supervisor selects which sections the innovator may edit; everything
 * else is rendered read-only (with a lock icon and disabled inputs). On save,
 * the API PATCHes only the sections that were actually editable — the server
 * enforces this second gate, so a client hack can't bypass the lock.
 *
 * When editableSections is empty (legacy pre-migration ideas), all sections
 * become editable — matching the previous behavior.
 */
export function IdeaEditForm({
  locale,
  ideaId,
  initial,
  activities,
  themes,
  editableSections,
  reason,
}: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // If supervisor didn't lock down sections, allow all.
  const openAll = editableSections.length === 0;
  const isEditable = (s: Section) => openAll || editableSections.includes(s);

  const [titleAr, setTitleAr] = useState(initial.title_ar ?? '');
  const [titleEn, setTitleEn] = useState(initial.title_en ?? '');
  const [solution, setSolution] = useState(initial.proposed_solution ?? '');
  const [activityId, setActivityId] = useState(initial.activity_id ?? '');
  const [themeId, setThemeId] = useState(initial.strategic_theme_id ?? '');
  const [challenge, setChallenge] = useState(initial.challenge ?? '');
  const [participation, setParticipation] = useState<'individual' | 'team'>(
    initial.participation_type
  );
  const [teamName, setTeamName] = useState(initial.team_name ?? '');
  const [teamMembers, setTeamMembers] = useState<TeamMemberInput[]>(
    initial.team_members.length > 0 ? initial.team_members : [{ name: '', email: '' }]
  );

  const optionLabel = (o: Option) => (isAr ? o.name_ar || o.name_en : o.name_en || o.name_ar) ?? '';

  function updateMember(idx: number, field: 'name' | 'email', value: string) {
    setTeamMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }
  function addMember() {
    setTeamMembers((prev) => [...prev, { name: '', email: '' }]);
  }
  function removeMember(idx: number) {
    setTeamMembers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  // Attachment uploads (only relevant when 'attachments' is editable). Files
  // upload immediately to the evidence bucket linked to this idea; there is no
  // deferred insert because the idea already exists.
  const [uploads, setUploads] = useState<
    Array<{ id: string; name: string; status: 'uploading' | 'done' | 'error'; error?: string }>
  >([]);

  function onAttachmentsSelected(files: File[]) {
    if (files.length === 0) return;
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const extOk = ATTACH_ALLOWED_EXT.test(file.name);
      if (!extOk) {
        setUploads((prev) => [...prev, { id: key, name: file.name, status: 'error', error: isAr ? 'نوع ملف غير مسموح' : 'File type not allowed' }]);
        continue;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        setUploads((prev) => [...prev, { id: key, name: file.name, status: 'error', error: isAr ? 'الحجم أكبر من 10 ميجابايت' : 'Larger than 10MB' }]);
        continue;
      }
      setUploads((prev) => [...prev, { id: key, name: file.name, status: 'uploading' }]);
      startTransition(async () => {
        try {
          const res = await uploadEvidence(file, 'idea_submission', {
            ideaId,
            entityType: 'idea',
            entityId: ideaId,
          });
          setUploads((prev) =>
            prev.map((u) =>
              u.id === key
                ? { ...u, status: res.ok ? 'done' : 'error', error: res.ok ? undefined : res.error }
                : u
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) => (u.id === key ? { ...u, status: 'error', error: String(err) } : u))
          );
        }
      });
    }
  }

  function save() {
    startTransition(async () => {
      const patch: Record<string, unknown> = {};
      if (isEditable('title')) {
        patch.title_ar = titleAr;
        patch.title_en = titleEn;
      }
      if (isEditable('proposed_solution')) patch.proposed_solution = solution;
      if (isEditable('activity_id')) patch.activity_id = activityId || null;
      if (isEditable('strategic_theme_id')) patch.strategic_theme_id = themeId || null;
      if (isEditable('challenge')) patch.challenge = challenge.trim() || null;
      if (isEditable('participation_type')) patch.participation_type = participation;
      if (isEditable('team')) {
        patch.team_name = participation === 'team' ? teamName.trim() || null : null;
        patch.team_members =
          participation === 'team'
            ? teamMembers
                .map((m) => ({ name: m.name.trim(), email: m.email.trim() }))
                .filter((m) => m.name || m.email)
            : [];
      }

      const res = await fetch(`/api/ideas/${ideaId}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({
          ok: true,
          msg: isAr ? 'تم إرسال التعديلات — الفكرة قيد الفرز مجدداً.' : 'Changes submitted — idea returned to screening.',
        });
        setTimeout(() => router.push(`/${locale}/ideas/${ideaId}`), 1200);
      } else {
        setFlash({ ok: false, msg: j.error || (isAr ? 'فشل الحفظ' : 'Save failed') });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Supervisor notes banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <div className="font-semibold text-amber-900">
            {isAr ? 'ملاحظات المشرف' : 'Supervisor notes'}
          </div>
          {reason ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{reason}</p>
          ) : (
            <p className="mt-1 text-sm text-amber-800">
              {isAr ? '—' : '—'}
            </p>
          )}
          {editableSections.length > 0 && (
            <div className="mt-3 text-xs text-amber-900">
              <span className="font-semibold">
                {isAr ? 'الأقسام المطلوب تعديلها: ' : 'Sections to edit: '}
              </span>
              {editableSections
                .map((s) =>
                  isAr ? sectionLabels.ar[s] ?? s : sectionLabels.en[s] ?? s
                )
                .join(isAr ? '، ' : ', ')}
            </div>
          )}
        </div>
      </div>

      {flash && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            flash.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* TITLE */}
      <SectionCard
        title={isAr ? sectionLabels.ar.title : sectionLabels.en.title}
        locked={!isEditable('title')}
        isAr={isAr}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
            <Input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              disabled={!isEditable('title')}
            />
          </div>
          <div>
            <Label>{isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
            <Input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              disabled={!isEditable('title')}
            />
          </div>
        </div>
      </SectionCard>

      {/* IDEA DESCRIPTION */}
      <SectionCard
        title={isAr ? sectionLabels.ar.proposed_solution : sectionLabels.en.proposed_solution}
        locked={!isEditable('proposed_solution')}
        isAr={isAr}
      >
        <Textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          rows={6}
          disabled={!isEditable('proposed_solution')}
        />
      </SectionCard>

      {/* ACTIVITY */}
      <SectionCard
        title={isAr ? sectionLabels.ar.activity_id : sectionLabels.en.activity_id}
        locked={!isEditable('activity_id')}
        isAr={isAr}
      >
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          disabled={!isEditable('activity_id')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
        >
          <option value="">{isAr ? '— اختر الفعالية —' : '— Select activity —'}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {optionLabel(a)}
            </option>
          ))}
        </select>
      </SectionCard>

      {/* TRACK / THEME */}
      <SectionCard
        title={isAr ? sectionLabels.ar.strategic_theme_id : sectionLabels.en.strategic_theme_id}
        locked={!isEditable('strategic_theme_id')}
        isAr={isAr}
      >
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          disabled={!isEditable('strategic_theme_id')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
        >
          <option value="">{isAr ? '— اختر المسار —' : '— Select track —'}</option>
          {themes.map((th) => (
            <option key={th.id} value={th.id}>
              {optionLabel(th)}
            </option>
          ))}
        </select>
      </SectionCard>

      {/* CHALLENGE */}
      <SectionCard
        title={isAr ? sectionLabels.ar.challenge : sectionLabels.en.challenge}
        locked={!isEditable('challenge')}
        isAr={isAr}
      >
        <Textarea
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          rows={3}
          disabled={!isEditable('challenge')}
        />
      </SectionCard>

      {/* PARTICIPATION TYPE */}
      <SectionCard
        title={isAr ? sectionLabels.ar.participation_type : sectionLabels.en.participation_type}
        locked={!isEditable('participation_type')}
        isAr={isAr}
      >
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="participation_type"
              checked={participation === 'individual'}
              onChange={() => setParticipation('individual')}
              disabled={!isEditable('participation_type')}
            />
            {isAr ? 'فردي' : 'Individual'}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="participation_type"
              checked={participation === 'team'}
              onChange={() => setParticipation('team')}
              disabled={!isEditable('participation_type')}
            />
            {isAr ? 'فريق' : 'Team'}
          </label>
        </div>
      </SectionCard>

      {/* TEAM */}
      <SectionCard
        title={isAr ? sectionLabels.ar.team : sectionLabels.en.team}
        locked={!isEditable('team')}
        isAr={isAr}
      >
        {participation === 'team' ? (
          <div className="space-y-4">
            <div>
              <Label>{isAr ? 'اسم الفريق' : 'Team name'}</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={!isEditable('team')}
              />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? 'أعضاء الفريق' : 'Team members'}</Label>
              {teamMembers.map((m, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder={isAr ? 'الاسم' : 'Name'}
                    value={m.name}
                    onChange={(e) => updateMember(idx, 'name', e.target.value)}
                    disabled={!isEditable('team')}
                  />
                  <Input
                    placeholder={isAr ? 'البريد الإلكتروني' : 'Email'}
                    type="email"
                    value={m.email}
                    onChange={(e) => updateMember(idx, 'email', e.target.value)}
                    disabled={!isEditable('team')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeMember(idx)}
                    disabled={!isEditable('team') || teamMembers.length <= 1}
                    aria-label={isAr ? 'حذف العضو' : 'Remove member'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {isEditable('team') && (
                <Button type="button" variant="outline" onClick={addMember}>
                  {isAr ? 'إضافة عضو' : 'Add member'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'مشاركة فردية — لا يوجد أعضاء فريق.'
              : 'Individual participation — no team members.'}
          </p>
        )}
      </SectionCard>

      {/* ATTACHMENTS — real upload input, wired to the evidence bucket.
          Files upload immediately (the idea already exists) linked to this
          idea id, matching the submit-form upload path. */}
      {isEditable('attachments') && (
        <SectionCard title={isAr ? sectionLabels.ar.attachments : sectionLabels.en.attachments} isAr={isAr}>
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition hover:border-brand-teal/40">
              <Paperclip className="h-6 w-6 text-brand-teal" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">
                {isAr ? 'اسحب الملفات هنا أو اضغط للاختيار' : 'Drag files here or click to choose'}
              </span>
              <span className="text-xs text-muted-foreground">
                {isAr ? 'PDF أو صور أو Word — حتى 10 ميجابايت لكل ملف' : 'PDF, images, or Word — up to 10MB each'}
              </span>
              <Input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  onAttachmentsSelected(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
            </label>
            {uploads.length > 0 && (
              <ul className="space-y-2">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white p-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      <span className="truncate">{u.name}</span>
                    </span>
                    {u.status === 'uploading' && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isAr ? 'جارٍ الرفع…' : 'Uploading…'}
                      </span>
                    )}
                    {u.status === 'done' && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isAr ? 'تم' : 'Done'}
                      </span>
                    )}
                    {u.status === 'error' && (
                      <span className="shrink-0 text-xs text-red-700">{u.error || (isAr ? 'فشل' : 'Failed')}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      )}
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => router.push(`/${locale}/ideas/${ideaId}`)}>
          <X className="h-4 w-4" />
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={save} disabled={pending} className="bg-brand-teal hover:bg-brand-teal/90">
          <Save className="h-4 w-4" />
          {pending
            ? isAr
              ? 'جارٍ الحفظ…'
              : 'Saving…'
            : isAr
              ? 'إرسال التعديلات'
              : 'Submit changes'}
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  locked,
  isAr,
  children,
}: {
  title: string;
  locked?: boolean;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={locked ? 'opacity-70' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base text-brand-teal">
          <span>{title}</span>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              <Lock className="h-3 w-3" />
              {isAr ? 'مقفل' : 'Locked'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const sectionLabels: { ar: Record<Section, string>; en: Record<Section, string> } = {
  ar: {
    activity_id: 'الفعالية',
    strategic_theme_id: 'المسار',
    challenge: 'التحدي',
    participation_type: 'نوع المشاركة',
    team: 'بيانات أعضاء الفريق',
    title: 'عنوان الفكرة',
    proposed_solution: 'وصف الفكرة',
    attachments: 'المرفقات',
  },
  en: {
    activity_id: 'Activity',
    strategic_theme_id: 'Track',
    challenge: 'Challenge',
    participation_type: 'Participation type',
    team: 'Team details',
    title: 'Idea title',
    proposed_solution: 'Idea description',
    attachments: 'Attachments',
  },
};
