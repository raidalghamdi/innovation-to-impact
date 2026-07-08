'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Lock, Save, X } from 'lucide-react';

type Section = 'title' | 'problem_statement' | 'proposed_solution' | 'expected_benefits' | 'attachments' | 'team';

type Props = {
  locale: string;
  ideaId: string;
  initial: {
    title_ar: string | null;
    title_en: string | null;
    problem_statement: string | null;
    proposed_solution: string | null;
    expected_benefits: string | null;
  };
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
  const [problem, setProblem] = useState(initial.problem_statement ?? '');
  const [solution, setSolution] = useState(initial.proposed_solution ?? '');
  const [benefits, setBenefits] = useState(initial.expected_benefits ?? '');

  function save() {
    startTransition(async () => {
      const patch: Record<string, unknown> = {};
      if (isEditable('title')) {
        patch.title_ar = titleAr;
        patch.title_en = titleEn;
      }
      if (isEditable('problem_statement')) patch.problem_statement = problem;
      if (isEditable('proposed_solution')) patch.proposed_solution = solution;
      if (isEditable('expected_benefits')) patch.expected_benefits = benefits;

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

      {/* PROBLEM */}
      <SectionCard
        title={isAr ? sectionLabels.ar.problem_statement : sectionLabels.en.problem_statement}
        locked={!isEditable('problem_statement')}
        isAr={isAr}
      >
        <Textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={5}
          disabled={!isEditable('problem_statement')}
        />
      </SectionCard>

      {/* SOLUTION */}
      <SectionCard
        title={isAr ? sectionLabels.ar.proposed_solution : sectionLabels.en.proposed_solution}
        locked={!isEditable('proposed_solution')}
        isAr={isAr}
      >
        <Textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          rows={5}
          disabled={!isEditable('proposed_solution')}
        />
      </SectionCard>

      {/* BENEFITS */}
      <SectionCard
        title={isAr ? sectionLabels.ar.expected_benefits : sectionLabels.en.expected_benefits}
        locked={!isEditable('expected_benefits')}
        isAr={isAr}
      >
        <Textarea
          value={benefits}
          onChange={(e) => setBenefits(e.target.value)}
          rows={4}
          disabled={!isEditable('expected_benefits')}
        />
      </SectionCard>

      {/* ATTACHMENTS + TEAM stubs — placeholders for now.
          Attachments require the existing evidence-upload flow which lives
          in idea-form.tsx and needs a dedicated integration effort. To keep
          this partial-edit route safe, we redirect the innovator to the
          existing team page + attachments upload page when those sections
          are checked. */}
      {isEditable('attachments') && (
        <SectionCard title={isAr ? sectionLabels.ar.attachments : sectionLabels.en.attachments} isAr={isAr}>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'لإدارة المرفقات الحالية أو رفع مرفقات جديدة، افتح صفحة الفكرة ثم قسم المرفقات.'
              : 'To manage or upload attachments, open the idea page and use the attachments section.'}
          </p>
        </SectionCard>
      )}
      {isEditable('team') && (
        <SectionCard title={isAr ? sectionLabels.ar.team : sectionLabels.en.team} isAr={isAr}>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'يمكن قائد الفريق تعديل الأعضاء من صفحة "فريقي".'
              : 'The team lead can edit members from the "My team" page.'}
          </p>
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

const sectionLabels = {
  ar: {
    title: 'عنوان الفكرة',
    problem_statement: 'بيان المشكلة',
    proposed_solution: 'الحل المقترح',
    expected_benefits: 'المنافع المتوقعة',
    attachments: 'المرفقات',
    team: 'بيانات الفريق',
  },
  en: {
    title: 'Idea title',
    problem_statement: 'Problem statement',
    proposed_solution: 'Proposed solution',
    expected_benefits: 'Expected benefits',
    attachments: 'Attachments',
    team: 'Team details',
  },
};
