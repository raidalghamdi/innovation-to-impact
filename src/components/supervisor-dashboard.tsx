'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';

type Idea = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  expected_benefits: string | null;
  strategic_theme_id: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  rejection_reason_ar: string | null;
};

type Theme = { id: string; title_ar: string | null; title_en: string | null };
type Evaluator = { id: string; full_name: string | null; email: string | null };
type TA = { id: string; theme_id: string; evaluator_id: string; status: string; assigned_at: string; notes: string | null };

type Props = {
  locale: string;
  ideas: Idea[];
  themes: Theme[];
  evaluators: Evaluator[];
  trackAssignments: TA[];
};

const SCREENING_STATUSES = new Set(['submitted', 'screening']);

export function SupervisorDashboard({ locale, ideas, themes, evaluators, trackAssignments }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [tab, setTab] = useState<'screening' | 'tracks' | 'archive'>('screening');
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();
  // Two-stage flow: view = full-detail review modal; decision = confirm sub-modal.
  const [viewIdea, setViewIdea] = useState<Idea | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  // For "return" decisions ONLY: which sections must the innovator revise?
  // These correspond to the idea-form sections. When empty, the innovator
  // can edit any field (backward compat). When set, only listed sections
  // are editable and the rest are locked.
  const RETURN_SECTIONS = [
    'title',
    'problem_statement',
    'proposed_solution',
    'expected_benefits',
    'attachments',
    'team',
  ] as const;
  type ReturnSection = typeof RETURN_SECTIONS[number];
  const [editableSections, setEditableSections] = useState<Set<ReturnSection>>(new Set());
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const themeMap = useMemo(() => {
    const m = new Map<string, Theme>();
    for (const t of themes) m.set(t.id, t);
    return m;
  }, [themes]);

  const evaluatorMap = useMemo(() => {
    const m = new Map<string, Evaluator>();
    for (const e of evaluators) m.set(e.id, e);
    return m;
  }, [evaluators]);

  // Screening tab data
  const screeningIdeas = useMemo(() => {
    return ideas.filter((i) => {
      if (!SCREENING_STATUSES.has(i.status)) return false;
      if (themeFilter !== 'all' && i.strategic_theme_id !== themeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (i.title_ar ?? '').toLowerCase().includes(q) ||
        (i.title_en ?? '').toLowerCase().includes(q) ||
        (i.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [ideas, search, themeFilter]);

  const archiveIdeas = useMemo(() => {
    return ideas.filter((i) => ['approved', 'assigned', 'evaluation', 'rejected', 'returned'].includes(i.status));
  }, [ideas]);

  // KPIs
  const kpi = useMemo(() => {
    const total = ideas.length;
    const pending = ideas.filter((i) => SCREENING_STATUSES.has(i.status)).length;
    const approved = ideas.filter((i) => ['approved', 'assigned', 'evaluation'].includes(i.status)).length;
    const rejected = ideas.filter((i) => i.status === 'rejected').length;
    const returned = ideas.filter((i) => i.status === 'returned').length;
    return { total, pending, approved, rejected, returned };
  }, [ideas]);

  function openReview(idea: Idea) {
    setViewIdea(idea);
    setDecision(null);
    setReason('');
    setEditableSections(new Set());
  }
  function closeReview() {
    setViewIdea(null);
    setDecision(null);
    setEditableSections(new Set());
  }
  function openDecision(kind: 'approve' | 'reject' | 'return') {
    setDecision(kind);
    setReason('');
    // Default: mark all sections as editable so a supervisor who just wants
    // an open-ended return doesn't have to tick every box.
    setEditableSections(new Set(RETURN_SECTIONS));
  }
  function toggleSection(s: ReturnSection) {
    setEditableSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const sectionLabels = {
    title: isAr ? 'عنوان الفكرة' : 'Idea title',
    problem_statement: isAr ? 'بيان المشكلة' : 'Problem statement',
    proposed_solution: isAr ? 'الحل المقترح' : 'Proposed solution',
    expected_benefits: isAr ? 'المنافع المتوقعة' : 'Expected benefits',
    attachments: isAr ? 'المرفقات' : 'Attachments',
    team: isAr ? 'بيانات الفريق' : 'Team details',
  } as const;

  function submitDecision() {
    if (!viewIdea || !decision) return;
    startTransition(async () => {
      // Single reason box — send the same text to both AR/EN fields so it shows
      // regardless of the innovator's current locale.
      const r = reason.trim() || null;
      // Only include editable_sections when decision === 'return'.
      const editable_sections =
        decision === 'return' ? Array.from(editableSections) : null;
      const res = await fetch(`/api/supervisor/ideas/${viewIdea.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: r,
          reason_ar: r,
          editable_sections,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({ ok: true, msg: isAr ? 'تم حفظ القرار' : 'Decision saved' });
        closeReview();
        router.refresh();
      } else {
        setFlash({ ok: false, msg: j.error || (isAr ? 'فشل الحفظ' : 'Save failed') });
      }
      setTimeout(() => setFlash(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label={isAr ? 'إجمالي' : 'Total'} value={kpi.total} />
        <KpiCard label={isAr ? 'قيد الفحص' : 'Pending screening'} value={kpi.pending} highlight />
        <KpiCard label={isAr ? 'مُعتمَدة' : 'Approved'} value={kpi.approved} tone="success" />
        <KpiCard label={isAr ? 'مُعادة' : 'Returned'} value={kpi.returned} tone="warning" />
        <KpiCard label={isAr ? 'مرفوضة' : 'Rejected'} value={kpi.rejected} tone="error" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton active={tab === 'screening'} onClick={() => setTab('screening')}>
          {isAr ? `الفحص (${screeningIdeas.length})` : `Screening (${screeningIdeas.length})`}
        </TabButton>
        <TabButton active={tab === 'tracks'} onClick={() => setTab('tracks')}>
          {isAr ? 'تعيين المسارات' : 'Track assignments'}
        </TabButton>
        <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>
          {isAr ? 'الأرشيف' : 'Archive'}
        </TabButton>
      </div>

      {flash && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${flash.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}
        >
          {flash.msg}
        </div>
      )}

      {/* Screening tab */}
      {tab === 'screening' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={isAr ? 'ابحث بالعنوان أو الرقم…' : 'Search title or code…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{isAr ? 'كل المسارات' : 'All tracks'}</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar}
                </option>
              ))}
            </select>
          </div>

          {screeningIdeas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {isAr ? 'لا توجد أفكار بحاجة إلى الفحص حالياً.' : 'No ideas awaiting screening.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {screeningIdeas.map((i) => {
                const theme = i.strategic_theme_id ? themeMap.get(i.strategic_theme_id) : null;
                return (
                  <Card
                    key={i.id}
                    className="flex cursor-pointer flex-col transition hover:border-teal-500 hover:shadow-md"
                    onClick={() => openReview(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openReview(i);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{i.code}</div>
                          <CardTitle className="mt-1 line-clamp-2 text-base">
                            {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                          </CardTitle>
                          {theme && (
                            <Badge variant="outline" className="mt-2">
                              {isAr ? theme.title_ar || theme.title_en : theme.title_en || theme.title_ar}
                            </Badge>
                          )}
                        </div>
                        <StatusBadge status={i.status as any} locale={locale} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                      {i.problem_statement && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {isAr ? 'المشكلة' : 'Problem'}
                          </div>
                          <p className="line-clamp-2 text-sm">{i.problem_statement}</p>
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                        <span>
                          {i.submitted_at
                            ? new Date(i.submitted_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')
                            : ''}
                        </span>
                        <span className="font-medium text-teal-700">
                          {isAr ? 'اضغط للمراجعة ←' : 'Click to review →'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Track assignments tab */}
      {tab === 'tracks' && (
        <TrackAssignmentsPanel
          locale={locale}
          themes={themes}
          evaluators={evaluators}
          assignments={trackAssignments}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Archive tab */}
      {tab === 'archive' && (
        <div className="grid gap-3">
          {archiveIdeas.map((i) => {
            const theme = i.strategic_theme_id ? themeMap.get(i.strategic_theme_id) : null;
            return (
              <Card key={i.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{i.code}</div>
                    <div className="truncate font-medium">
                      {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                    </div>
                    {theme && (
                      <div className="text-xs text-muted-foreground">
                        {isAr ? theme.title_ar || theme.title_en : theme.title_en || theme.title_ar}
                      </div>
                    )}
                    {(i.rejection_reason_ar || i.rejection_reason) && (
                      <div className="mt-1 text-xs text-red-700">
                        {isAr ? i.rejection_reason_ar || i.rejection_reason : i.rejection_reason || i.rejection_reason_ar}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={i.status as any} locale={locale} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full-review modal — supervisor sees the entire idea, then acts. */}
      {viewIdea && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeReview}
        >
          <Card
            className="max-h-[92vh] w-full max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{viewIdea.code}</div>
                  <CardTitle className="mt-1 text-lg">
                    {isAr ? viewIdea.title_ar || viewIdea.title_en : viewIdea.title_en || viewIdea.title_ar}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {viewIdea.strategic_theme_id && themeMap.get(viewIdea.strategic_theme_id) && (
                      <Badge variant="outline">
                        {(() => {
                          const th = themeMap.get(viewIdea.strategic_theme_id!)!;
                          return isAr ? th.title_ar || th.title_en : th.title_en || th.title_ar;
                        })()}
                      </Badge>
                    )}
                    <StatusBadge status={viewIdea.status as any} locale={locale} />
                    {viewIdea.submitted_at && (
                      <span className="text-xs text-muted-foreground">
                        {isAr ? 'قُدّمت في' : 'Submitted'}{' '}
                        {new Date(viewIdea.submitted_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeReview}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <div className="max-h-[60vh] overflow-y-auto">
              <CardContent className="space-y-5 py-5">
                {viewIdea.problem_statement && (
                  <ReviewSection label={isAr ? 'المشكلة' : 'Problem statement'} value={viewIdea.problem_statement} />
                )}
                {viewIdea.proposed_solution && (
                  <ReviewSection
                    label={isAr ? 'الحل المقترح' : 'Proposed solution'}
                    value={viewIdea.proposed_solution}
                  />
                )}
                {viewIdea.expected_benefits && (
                  <ReviewSection
                    label={isAr ? 'الفوائد المتوقعة' : 'Expected benefits'}
                    value={viewIdea.expected_benefits}
                  />
                )}
                {(viewIdea.rejection_reason_ar || viewIdea.rejection_reason) && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-800">
                      {isAr ? 'سبب سابق' : 'Previous reason'}
                    </div>
                    <p className="mt-1 text-sm text-red-900">
                      {isAr
                        ? viewIdea.rejection_reason_ar || viewIdea.rejection_reason
                        : viewIdea.rejection_reason || viewIdea.rejection_reason_ar}
                    </p>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Action bar — either action picker or reason form */}
            <div className="border-t bg-muted/30 p-4">
              {!decision ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    {isAr ? 'اتخذ قراراً بشأن هذه الفكرة:' : 'Take a decision on this idea:'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => openDecision('approve')} className="bg-green-700 hover:bg-green-800">
                      {isAr ? 'اعتماد' : 'Approve'}
                    </Button>
                    <Button variant="outline" onClick={() => openDecision('return')}>
                      {isAr ? 'إعادة للمبتكر' : 'Return'}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500 text-red-700 hover:bg-red-50"
                      onClick={() => openDecision('reject')}
                    >
                      {isAr ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    {decision === 'approve' && (isAr ? 'تأكيد الاعتماد' : 'Confirm approval')}
                    {decision === 'reject' && (isAr ? 'تأكيد الرفض' : 'Confirm rejection')}
                    {decision === 'return' && (isAr ? 'إعادة الفكرة للمبتكر للتعديل' : 'Return idea to innovator')}
                  </div>
                  {decision === 'return' && (
                    <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3">
                      <div className="mb-2 text-xs font-semibold text-amber-900">
                        {isAr
                          ? 'اختر الأقسام التي يجب على المبتكر تعديلها:'
                          : 'Select which sections the innovator must edit:'}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {RETURN_SECTIONS.map((s) => (
                          <label
                            key={s}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={editableSections.has(s)}
                              onChange={() => toggleSection(s)}
                              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <span>{sectionLabels[s]}</span>
                          </label>
                        ))}
                      </div>
                      {editableSections.size === 0 && (
                        <div className="mt-2 text-xs text-red-700">
                          {isAr
                            ? 'اختر قسماً واحداً على الأقل.'
                            : 'Select at least one section.'}
                        </div>
                      )}
                    </div>
                  )}
                  {decision !== 'approve' && (
                    <div>
                      <Label>
                        {decision === 'return'
                          ? isAr
                            ? 'ملاحظات المشرف'
                            : 'Supervisor notes'
                          : isAr
                            ? 'السبب'
                            : 'Reason'}
                      </Label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          decision === 'return'
                            ? isAr
                              ? 'اشرح للمبتكر ما يجب تعديله…'
                              : 'Explain to the innovator what needs updating…'
                            : isAr
                              ? 'اكتب السبب…'
                              : 'Write the reason…'
                        }
                        rows={3}
                      />
                      {decision === 'return' && reason.trim().length < 10 && (
                        <div className="mt-1 text-xs text-red-700">
                          {isAr
                            ? 'اكتب سبب الإرجاع (10 أحرف على الأقل).'
                            : 'Enter a return reason (at least 10 characters).'}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={submitDecision}
                      disabled={
                        pending ||
                        (decision === 'return' &&
                          (editableSections.size === 0 || reason.trim().length < 10))
                      }
                      className={
                        decision === 'approve'
                          ? 'bg-green-700 hover:bg-green-800'
                          : decision === 'reject'
                          ? 'bg-red-700 hover:bg-red-800'
                          : ''
                      }
                    >
                      {pending ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : isAr ? 'تأكيد' : 'Confirm'}
                    </Button>
                    <Button variant="outline" onClick={() => setDecision(null)} disabled={pending}>
                      {isAr ? 'رجوع' : 'Back'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: 'success' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'error'
      ? 'text-red-700'
      : highlight
      ? 'text-teal-700'
      : '';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-teal-600 text-teal-700'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ReviewSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function TrackAssignmentsPanel({
  locale,
  themes,
  evaluators,
  assignments,
  onChanged,
}: {
  locale: string;
  themes: Theme[];
  evaluators: Evaluator[];
  assignments: TA[];
  onChanged: () => void;
}) {
  const isAr = locale === 'ar';
  const [selectedTheme, setSelectedTheme] = useState<string>(themes[0]?.id ?? '');
  const [selectedEval, setSelectedEval] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const byTheme = useMemo(() => {
    const m = new Map<string, TA[]>();
    for (const a of assignments) {
      const arr = m.get(a.theme_id) ?? [];
      arr.push(a);
      m.set(a.theme_id, arr);
    }
    return m;
  }, [assignments]);

  // Evaluators already assigned to the currently-selected track (to grey them out).
  const alreadyAssignedIds = useMemo(() => {
    return new Set((byTheme.get(selectedTheme) ?? []).map((r) => r.evaluator_id));
  }, [byTheme, selectedTheme]);

  function assign() {
    if (!selectedTheme || !selectedEval) return;
    startTransition(async () => {
      const res = await fetch('/api/supervisor/track-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: selectedTheme, evaluatorIds: [selectedEval] }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: isAr ? 'تم التعيين' : 'Assigned' });
        setSelectedEval('');
        onChanged();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.error || (isAr ? 'فشل التعيين' : 'Assign failed') });
      }
      setTimeout(() => setMsg(null), 2500);
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/supervisor/track-assignments?id=${id}`, { method: 'DELETE' });
      if (res.ok) onChanged();
    });
  }

  const themeLabel = (t: Theme) => (isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar) ?? '';
  const evalLabel = (e: Evaluator) => e.full_name || e.email || e.id.slice(0, 6);
  const currentThemeAssignments = byTheme.get(selectedTheme) ?? [];

  return (
    <div className="space-y-6">
      {/* Assign form: dropdown track + dropdown evaluator + Add */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAr ? 'تعيين مقيّمين لمسار' : 'Assign evaluators to a track'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label>{isAr ? 'المسار' : 'Track'}</Label>
              <select
                value={selectedTheme}
                onChange={(e) => {
                  setSelectedTheme(e.target.value);
                  setSelectedEval('');
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  {isAr ? '— اختر المسار —' : '— Choose a track —'}
                </option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {themeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{isAr ? 'المقيّم' : 'Evaluator'}</Label>
              <select
                value={selectedEval}
                onChange={(e) => setSelectedEval(e.target.value)}
                disabled={!selectedTheme || evaluators.length === 0}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">
                  {evaluators.length === 0
                    ? isAr
                      ? 'لا يوجد مقيّمون'
                      : 'No evaluators available'
                    : isAr
                    ? '— اختر مقيّماً —'
                    : '— Choose an evaluator —'}
                </option>
                {evaluators.map((e) => {
                  const taken = alreadyAssignedIds.has(e.id);
                  return (
                    <option key={e.id} value={e.id} disabled={taken}>
                      {evalLabel(e)}
                      {e.email ? ` — ${e.email}` : ''}
                      {taken ? (isAr ? ' (مُعيّن مسبقاً)' : ' (already assigned)') : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={assign}
                disabled={pending || !selectedTheme || !selectedEval}
                className="h-10 w-full md:w-auto"
              >
                {pending ? (isAr ? 'جارٍ…' : 'Adding…') : isAr ? '+ إضافة' : '+ Add'}
              </Button>
            </div>
          </div>
          {msg && (
            <div
              className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}
            >
              {msg.text}
            </div>
          )}
          {evaluators.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {isAr
                ? 'لا يوجد مقيّمون بعد. أنشئهم من إدارة المستخدمين.'
                : 'No evaluators yet. Create them via User management.'}
            </div>
          )}

          {/* Chips for the currently-selected track — quick view/remove */}
          {selectedTheme && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isAr ? 'مقيّمو هذا المسار' : 'Evaluators on this track'}
                <span className="ml-1 rtl:mr-1 rtl:ml-0">({currentThemeAssignments.length})</span>
              </div>
              {currentThemeAssignments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {isAr ? 'لا يوجد مقيّمون معيّنون بعد.' : 'None assigned yet.'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {currentThemeAssignments.map((r) => {
                    const ev = evaluators.find((e) => e.id === r.evaluator_id);
                    return (
                      <Badge key={r.id} variant="secondary" className="gap-2 py-1">
                        <span>{ev ? evalLabel(ev) : r.evaluator_id.slice(0, 6)}</span>
                        <button
                          onClick={() => revoke(r.id)}
                          className="text-red-600 hover:text-red-800"
                          title={isAr ? 'إزالة' : 'Remove'}
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full summary — all tracks and their evaluators */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isAr ? 'نظرة عامة على جميع المسارات' : 'All tracks overview'}
        </div>
        {themes.map((t) => {
          const rows = byTheme.get(t.id) ?? [];
          return (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{themeLabel(t)}</div>
                  <div className="text-xs text-muted-foreground">
                    {rows.length} {isAr ? 'مقيّم' : 'evaluators'}
                  </div>
                </div>
                {rows.length === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {isAr ? 'فارغ' : 'Empty'}
                  </Badge>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rows.map((r) => {
                      const ev = evaluators.find((e) => e.id === r.evaluator_id);
                      return (
                        <Badge key={r.id} variant="secondary" className="gap-2 py-1">
                          <span>{ev ? evalLabel(ev) : r.evaluator_id.slice(0, 6)}</span>
                          <button
                            onClick={() => revoke(r.id)}
                            className="text-red-600 hover:text-red-800"
                            title={isAr ? 'إزالة' : 'Remove'}
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
